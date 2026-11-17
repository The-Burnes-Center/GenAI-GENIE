import * as cdk from "aws-cdk-lib";
import { type IConstruct } from "constructs";
import { resourceName, type Environment } from "../config";

export const tagsFor = (environment: Environment): Record<string, string> => ({
  Project: "genai-genie",
  Environment: environment,
  ManagedBy: "cdk",
  Owner: "burnes-center",
});

const toCfnTags = (tags: Record<string, string>) => Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));

/**
 * aws-cdk-lib's own helper resources (BucketDeployment, auto-delete provider, the AWS CLI layer) are
 * created as raw CfnResources, so `Tags.of()` skips them and they get generated names. This aspect
 * gives the ones that support it explicit names and the four tags.
 */
export class CustomResourceNaming implements cdk.IAspect {
  private readonly tags: { Key: string; Value: string }[];

  constructor(private readonly environment: Environment) {
    this.tags = toCfnTags(tagsFor(environment));
  }

  visit(node: IConstruct): void {
    if (!(node instanceof cdk.CfnResource)) return;
    const name = (part: string) => resourceName(this.environment, part);
    const path = node.node.path;
    const isAutoDelete = path.includes("AutoDeleteObjectsCustomResourceProvider");
    const isDeployment = path.includes("CDKBucketDeployment");
    const isLayer = node.cfnResourceType === "AWS::Lambda::LayerVersion";
    if (node.cfnResourceType === "AWS::Lambda::Function" && isAutoDelete) {
      node.addPropertyOverride("FunctionName", name("auto-delete-objects"));
    }
    if (node.cfnResourceType === "AWS::IAM::Role" && isAutoDelete) {
      node.addPropertyOverride("RoleName", name("auto-delete-objects-role"));
    }
    if (node.cfnResourceType === "AWS::Lambda::Function" && isDeployment) {
      node.addPropertyOverride("FunctionName", name("site-deploy"));
    }
    if (node.cfnResourceType === "AWS::IAM::Role" && isDeployment) {
      node.addPropertyOverride("RoleName", name("site-deploy-role"));
    }
    if (isLayer) node.addPropertyOverride("LayerName", name("aws-cli"));
    // Raw CfnResources without a TagManager: add Tags by hand.
    const rawTaggable = ["AWS::Lambda::Function", "AWS::IAM::Role"].includes(node.cfnResourceType);
    if (rawTaggable && !cdk.TagManager.isTaggable(node) && (isAutoDelete || isDeployment)) {
      node.addPropertyOverride("Tags", this.tags);
    }
  }
}
