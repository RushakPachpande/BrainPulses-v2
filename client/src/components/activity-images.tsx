import { StoredImage } from './stored-image';
import type { StudentActivity } from '../services/types';

function coverOf(item: StudentActivity) {
  const fileId = item.contestImageFileId || item.sponsorImageFileId;
  if (!fileId) return null;
  return {
    fileId,
    alt: item.contestName || item.sponsorName || item.name,
  };
}

export function ActivityCover({
  item,
  className,
  imgClassName,
}: {
  item: StudentActivity;
  className: string;
  imgClassName: string;
}) {
  const cover = coverOf(item);
  if (!cover) return null;
  return (
    <div className={className}>
      <StoredImage src={`/api/files/${cover.fileId}`} alt={cover.alt} className={imgClassName} />
    </div>
  );
}

export function ActivityCredit({ item }: { item: StudentActivity }) {
  if (!item.sponsorName && !item.contestName) return null;
  const coverId = item.contestImageFileId || item.sponsorImageFileId;
  const markId =
    item.sponsorImageFileId && item.sponsorImageFileId !== coverId ? item.sponsorImageFileId : null;
  return (
    <p className="activity-credit">
      {markId ? (
        <StoredImage src={`/api/files/${markId}`} alt="" className="activity-sponsor-mark" />
      ) : null}
      <span>{[item.sponsorName, item.contestName].filter(Boolean).join(' · ')}</span>
    </p>
  );
}
