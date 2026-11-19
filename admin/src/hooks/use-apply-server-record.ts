import { useEffect, useRef } from 'react';

/**
 * Copy a cached record into form state when its id changes, or when a refetch
 * arrives and the form is not dirty. A background refresh must not wipe edits.
 */
export function useApplyServerRecord<T>(
  record: T | undefined,
  recordKey: string,
  dirty: boolean,
  apply: (record: T) => void,
) {
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const seenKey = useRef<string | null>(null);
  const seenRecord = useRef<T | undefined>(undefined);

  useEffect(() => {
    if (record === undefined || recordKey === '') return;
    const keyChanged = seenKey.current !== recordKey;
    if (!keyChanged && dirty) return;
    if (!keyChanged && seenRecord.current === record) return;
    seenKey.current = recordKey;
    seenRecord.current = record;
    applyRef.current(record);
  }, [record, recordKey, dirty]);
}
