import { Button, Spinner } from "@cloudscape-design/components";
import { Children, ReactNode } from "react";
import styles from "../../styles/file-chip.module.scss";
import { getFileTypeInfo } from "./documents";

interface FileChipProps {
  name: string;
  previewUrl?: string; // image thumbnail shown in the tile
  href?: string; // makes the chip a link that opens the file
  onRemove?: () => void; // adds a remove button (composer)
  pending?: boolean; // still uploading
}

// One attached file: colored type tile (red PDF, blue Word, green spreadsheet...), name and type.
export function FileChip({ name, previewUrl, href, onRemove, pending }: FileChipProps) {
  const type = getFileTypeInfo(name);
  const tile = (
    <span className={`${styles.tile} ${styles[type.kind]}`} aria-hidden="true">
      {pending ? <Spinner variant="inverted" /> : previewUrl ? <img src={previewUrl} alt="" /> : type.badge}
    </span>
  );
  const details = (
    <span className={styles.details}>
      <span className={styles.name} title={name}>
        {name}
      </span>
      <span className={styles.type}>{pending ? "Uploading..." : type.label}</span>
    </span>
  );

  if (href) {
    return (
      <a className={styles.chip} href={href} target="_blank" rel="noreferrer" aria-label={`Open ${name}, ${type.label}, in a new tab`}>
        {tile}
        {details}
      </a>
    );
  }
  return (
    <div className={styles.chip}>
      {tile}
      {details}
      {onRemove && !pending && <Button variant="icon" iconName="close" ariaLabel={`Remove ${name}`} onClick={onRemove} />}
    </div>
  );
}

interface FileChipListProps {
  label: string;
  alignEnd?: boolean;
  children: ReactNode;
}

export function FileChipList({ label, alignEnd, children }: FileChipListProps) {
  return (
    <ul className={`${styles.list} ${alignEnd ? styles.list_end : ""}`} aria-label={label}>
      {/* Children.map carries each child's key over to its list item */}
      {Children.map(children, (child) => (
        <li>{child}</li>
      ))}
    </ul>
  );
}

// Shown over the page while files are dragged in; the drop itself is handled by useAttachFiles.
export function DropOverlay() {
  return (
    <div className={styles.drop_overlay} aria-hidden="true">
      <div className={styles.drop_card}>
        <div className={styles.drop_tiles}>
          <span className={`${styles.tile} ${styles.pdf}`}>PDF</span>
          <span className={`${styles.tile} ${styles.doc}`}>DOC</span>
          <span className={`${styles.tile} ${styles.sheet}`}>XLS</span>
        </div>
        <div className={styles.drop_title}>Drop files to attach</div>
        <div className={styles.type}>PDF, Word, Excel, CSV, text or images, up to 5 files</div>
      </div>
    </div>
  );
}
