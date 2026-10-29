import type { ReactNode } from 'react';
import { StoredImage } from './stored-image';
import { KindIcon } from './ui-bits';
import type { StudentActivity } from '../services/types';

function coverOf(item: StudentActivity) {
  const fileId = item.imageFileId || item.contestImageFileId || item.sponsorImageFileId;
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

export function ActivityCardMedia({
  item,
  children,
}: {
  item: StudentActivity;
  children: ReactNode;
}) {
  const cover = coverOf(item);
  return (
    <div className={`activity-card-media${cover ? '' : ' is-placeholder'}`}>
      {cover ? (
        <StoredImage
          src={`/api/files/${cover.fileId}`}
          alt={cover.alt}
          className="activity-card-photo"
        />
      ) : (
        <span className="activity-card-placeholder" aria-hidden>
          <KindIcon kind={item.kind} />
        </span>
      )}
      <div className="activity-card-overlay">{children}</div>
    </div>
  );
}

export function ActivityOrganizer({ item }: { item: StudentActivity }) {
  if (!item.sponsorName && !item.contestName) return null;
  const lead = item.sponsorName || item.contestName || '';
  const rest = item.sponsorName ? item.contestName : null;
  return (
    <p className="activity-organizer">
      {item.sponsorImageFileId ? (
        <StoredImage
          src={`/api/files/${item.sponsorImageFileId}`}
          alt=""
          className="activity-organizer-badge"
        />
      ) : (
        <span className="activity-organizer-badge" aria-hidden>
          {lead.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="activity-organizer-text">
        <strong>{lead}</strong>
        {rest ? (
          <>
            <span className="activity-organizer-sep" aria-hidden>
              /
            </span>
            {rest}
          </>
        ) : null}
      </span>
    </p>
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
