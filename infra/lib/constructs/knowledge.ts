import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3vectors from "aws-cdk-lib/aws-s3vectors";
import * as cdk from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { resourceName, type Environment } from "../../config";

export interface KnowledgeProps {
  environment: Environment;
  uploadsBucket: s3.IBucket;
}

const EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0";
const EMBEDDING_DIMENSIONS = 1024;
export const WORKSPACE_PREFIX = "workspaces/";

/** S3 Vectors store, Bedrock knowledge base over `workspaces/`, and the data source. */
export class Knowledge extends Construct {
  readonly knowledgeBase: bedrock.CfnKnowledgeBase;
  readonly dataSource: bedrock.CfnDataSource;

  constructor(scope: Construct, id: string, props: KnowledgeProps) {
    super(scope, id);
    const stack = cdk.Stack.of(this);
    const name = (part: string) => resourceName(props.environment, part);

    const vectorBucket = new s3vectors.CfnVectorBucket(this, "VectorBucket", {
      vectorBucketName: `${name("vectors")}-${cdk.Aws.ACCOUNT_ID}`,
      encryptionConfiguration: { sseType: "AES256" },
    });
    const index = new s3vectors.CfnIndex(this, "VectorIndex", {
      indexName: name("documents"),
      vectorBucketArn: vectorBucket.attrVectorBucketArn,
      dataType: "float32",
      dimension: EMBEDDING_DIMENSIONS,
      distanceMetric: "cosine",
      metadataConfiguration: { nonFilterableMetadataKeys: ["AMAZON_BEDROCK_TEXT", "AMAZON_BEDROCK_METADATA"] },
    });

    const role = new iam.Role(this, "KnowledgeBaseRole", {
      roleName: name("kb-role"),
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com", {
        conditions: {
          StringEquals: { "aws:SourceAccount": stack.account },
          ArnLike: { "aws:SourceArn": `arn:${stack.partition}:bedrock:${stack.region}:${stack.account}:knowledge-base/*` },
        },
      }),
    });
    const embeddingModelArn = `arn:${stack.partition}:bedrock:${stack.region}::foundation-model/${EMBEDDING_MODEL_ID}`;
    role.addToPolicy(new iam.PolicyStatement({ actions: ["bedrock:InvokeModel"], resources: [embeddingModelArn] }));
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:ListBucket"],
        resources: [props.uploadsBucket.bucketArn],
        conditions: { StringLike: { "s3:prefix": [`${WORKSPACE_PREFIX}*`] } },
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({ actions: ["s3:GetObject"], resources: [props.uploadsBucket.arnForObjects(`${WORKSPACE_PREFIX}*`)] }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3vectors:GetIndex", "s3vectors:QueryVectors", "s3vectors:PutVectors", "s3vectors:GetVectors", "s3vectors:DeleteVectors"],
        resources: [index.attrIndexArn],
      }),
    );
    NagSuppressions.addResourceSuppressions(
      role,
      [{ id: "AwsSolutions-IAM5", reason: "Read access is limited to objects under the workspaces/ prefix of the uploads bucket; object keys are not known at deploy time.", appliesTo: [{ regex: "/^Resource::.*workspaces/\\*$/" }] }],
      true,
    );

    this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, "KnowledgeBase", {
      name: name("documents"),
      description: "Genie document workspaces",
      roleArn: role.roleArn,
      knowledgeBaseConfiguration: {
        type: "VECTOR",
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn,
          embeddingModelConfiguration: {
            bedrockEmbeddingModelConfiguration: { dimensions: EMBEDDING_DIMENSIONS, embeddingDataType: "FLOAT32" },
          },
        },
      },
      storageConfiguration: {
        type: "S3_VECTORS",
        s3VectorsConfiguration: { vectorBucketArn: vectorBucket.attrVectorBucketArn, indexArn: index.attrIndexArn },
      },
    });
    this.knowledgeBase.node.addDependency(role);

    this.dataSource = new bedrock.CfnDataSource(this, "WorkspaceDataSource", {
      name: name("workspaces"),
      knowledgeBaseId: this.knowledgeBase.attrKnowledgeBaseId,
      dataSourceConfiguration: {
        type: "S3",
        s3Configuration: { bucketArn: props.uploadsBucket.bucketArn, inclusionPrefixes: [WORKSPACE_PREFIX] },
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: "FIXED_SIZE",
          fixedSizeChunkingConfiguration: { maxTokens: 800, overlapPercentage: 15 },
        },
      },
    });
  }

  get knowledgeBaseArn(): string {
    return this.knowledgeBase.attrKnowledgeBaseArn;
  }
}
