import '../config/load-env.js';
import { disconnectPrisma, prisma } from '../lib/prisma.js';
import { destinationForBank, placeOwnedImage } from '../modules/files/place.js';
import {
  assignOwners,
  destinationKey,
  fileIdsInAnswerKey,
  fileIdsInText,
  relocationTarget,
  type ImageDestination,
} from '../modules/files/paths.js';

type Claim = { fileId: string; ownerKey: string; dest: ImageDestination };

const ambiguousDest: ImageDestination = {
  kind: 'reusable-bank',
  bankKind: 'assessment',
  bankName: 'unused',
  bankId: '00000000-0000-0000-0000-000000000000',
};

async function claimsForOrganization(organizationId: string): Promise<Claim[]> {
  const claims: Claim[] = [];

  const sponsors = await prisma.sponsor.findMany({
    where: { organizationId },
    select: { id: true, name: true, imageFileId: true },
  });
  for (const sponsor of sponsors) {
    const dest: ImageDestination = {
      kind: 'sponsor',
      sponsorName: sponsor.name,
      sponsorId: sponsor.id,
    };
    claims.push({ fileId: sponsor.imageFileId, ownerKey: destinationKey(dest), dest });
  }

  const contests = await prisma.contest.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      sponsorId: true,
      imageFileId: true,
      sponsor: { select: { name: true } },
    },
  });
  for (const contest of contests) {
    const dest: ImageDestination = {
      kind: 'contest',
      sponsorName: contest.sponsor.name,
      sponsorId: contest.sponsorId,
      contestName: contest.name,
      contestId: contest.id,
    };
    claims.push({ fileId: contest.imageFileId, ownerKey: destinationKey(dest), dest });
  }

  const activities = await prisma.activity.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      kind: true,
      imageFileId: true,
      rounds: { select: { id: true, name: true, imageFileId: true } },
    },
  });
  for (const activity of activities) {
    if (activity.imageFileId) {
      const dest: ImageDestination = {
        kind: 'activity',
        activityKind: activity.kind,
        activityName: activity.name,
        activityId: activity.id,
      };
      claims.push({ fileId: activity.imageFileId, ownerKey: destinationKey(dest), dest });
    }
    for (const round of activity.rounds) {
      if (!round.imageFileId) continue;
      const dest: ImageDestination = {
        kind: 'round',
        activityName: activity.name,
        activityId: activity.id,
        roundName: round.name,
        roundId: round.id,
      };
      claims.push({ fileId: round.imageFileId, ownerKey: destinationKey(dest), dest });
    }
  }

  const versions = await prisma.questionVersion.findMany({
    where: { organizationId },
    select: {
      answerKey: true,
      options: { select: { imageUrl: true } },
      parentQuestion: { select: { bankId: true } },
    },
  });
  const banksByFile = new Map<string, Set<string>>();
  for (const version of versions) {
    const bankId = version.parentQuestion.bankId;
    const ids = [
      ...fileIdsInAnswerKey(version.answerKey),
      ...version.options.flatMap((option) => fileIdsInText(option.imageUrl)),
    ];
    for (const fileId of ids) {
      const banks = banksByFile.get(fileId) ?? new Set<string>();
      banks.add(bankId);
      banksByFile.set(fileId, banks);
    }
  }

  for (const [fileId, bankIds] of banksByFile) {
    if (bankIds.size !== 1) {
      for (const bankId of bankIds) {
        claims.push({ fileId, ownerKey: `question-bank:${bankId}`, dest: ambiguousDest });
      }
      continue;
    }
    const bankId = [...bankIds][0];
    if (!bankId) continue;
    const dest = await destinationForBank(organizationId, bankId);
    if (!dest) continue;
    claims.push({ fileId, ownerKey: destinationKey(dest), dest });
  }

  return claims;
}

async function main() {
  const organizations = await prisma.organization.findMany({ select: { id: true, slug: true } });
  let moved = 0;
  let skipped = 0;

  for (const organization of organizations) {
    const decisions = assignOwners(await claimsForOrganization(organization.id));
    const files = await prisma.fileObject.findMany({
      where: { organizationId: organization.id },
      select: { id: true, originalName: true },
    });
    for (const file of files) {
      const label = `${organization.slug} ${file.id} ${file.originalName}`;
      const target = relocationTarget(decisions.get(file.id.toLowerCase()));
      if (!target) {
        const reason =
          decisions.get(file.id.toLowerCase()) === 'ambiguous' ? 'more than one owner' : 'no owner';
        console.log(`skip ${label} (${reason})`);
        skipped += 1;
        continue;
      }
      try {
        const result = await placeOwnedImage(organization.id, file.id, target);
        if (result === 'moved') {
          console.log(`moved ${label} -> ${destinationKey(target)}`);
          moved += 1;
        } else {
          console.log(`skip ${label} (${result})`);
          skipped += 1;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'move failed';
        console.log(`skip ${label} (${message})`);
        skipped += 1;
      }
    }
  }

  console.log(`done moved=${moved} skipped=${skipped}`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
