import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

import { deriveAccent, deriveInitials } from "@/server/auth/identity";
import * as schema from "@/server/db/schema";

const { groupMemberships, groups, knowledgeItems, profiles, reviewMarks, studyRuns } = schema;

const email = process.env.OWNER_EMAIL;
const groupName = process.env.OWNER_GROUP_NAME ?? "Dutch Study Group";
if (!email) throw new Error("OWNER_EMAIL is required");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_DIRECT_URL;
if (!supabaseUrl || !serviceKey || !dbUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_DIRECT_URL are required",
  );
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const client = postgres(dbUrl);
const db = drizzle(client, { schema });

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "group"
  );
}

/** The 9 non-reading, non-file items from the former MOCK_KNOWLEDGE mock —
 * inserted first so the reading item below can link to their real (DB-
 * generated) ids, same as the mock's `vocabularyIds: ["kn_afentoe",
 * "kn_rekening", "kn_gezellig"]`. All attributed to the seed owner —
 * reproducing the mock's multi-author attribution (Sofie/Omar/Lena) would
 * require fabricating auth users outside the invite flow. */
function demoKnowledgeItemsExceptReading(
  groupId: string,
  ownerId: string,
): (typeof knowledgeItems.$inferInsert)[] {
  const by = { groupId, addedBy: ownerId };
  return [
    {
      ...by,
      type: "vocabulary",
      level: "B1",
      tags: ["uitdrukking", "formeel"],
      source: "manual",
      term: "rekening houden met",
      meaning: "to take into account",
      partOfSpeech: "Uitdrukking",
      example: "Je moet rekening houden met het weer.",
      exampleTranslation: "You have to take the weather into account.",
      usageNote: "Vaste combinatie met 'met'; niet los te vertalen.",
    },
    {
      ...by,
      type: "vocabulary",
      level: "A2",
      tags: ["spreektaal"],
      source: "photo",
      term: "gezellig",
      meaning: "cozy / pleasant",
      partOfSpeech: "Bijvoeglijk naamwoord",
      example: "Het was een gezellige avond.",
      exampleTranslation: "It was a pleasant evening.",
      usageNote: "Typisch Nederlands begrip; moeilijk exact te vertalen.",
    },
    {
      ...by,
      type: "vocabulary",
      level: "A2",
      tags: ["uitdrukking", "frequentie"],
      source: "manual",
      term: "af en toe",
      meaning: "from time to time",
      partOfSpeech: "Uitdrukking",
      example: "Ik ga af en toe naar Antwerpen.",
      exampleTranslation: "I go to Antwerp from time to time.",
    },
    {
      ...by,
      type: "vocabulary",
      level: "A2",
      tags: ["werkwoord", "scheidbaar"],
      source: "manual",
      term: "afspreken",
      meaning: "to arrange / to agree",
      partOfSpeech: "Werkwoord",
      example: "We spreken morgen af.",
      exampleTranslation: "We'll arrange to meet tomorrow.",
      pastTense: "sprak af",
      perfect: "heeft afgesproken",
      usageNote: "Scheidbaar werkwoord: 'af' gaat naar het einde van de zin.",
    },
    {
      ...by,
      type: "vocabulary",
      level: "A2",
      tags: ["werk", "zelfstandig naamwoord"],
      source: "file-upload",
      term: "de vergadering",
      meaning: "the meeting",
      partOfSpeech: "Zelfstandig naamwoord",
      example: "De vergadering begint om negen uur.",
      exampleTranslation: "The meeting starts at nine.",
      article: "de",
      plural: "vergaderingen",
    },
    {
      ...by,
      type: "grammar",
      level: "B1",
      tags: ["woordvolgorde"],
      source: "manual",
      title: "Inversie",
      summary: "Zin begint met iets anders dan het onderwerp → werkwoord vóór onderwerp.",
      explanation:
        "Normaal is de volgorde onderwerp – werkwoord. Zet je een ander zinsdeel vooraan (tijd, plaats, een bijzin), dan wisselen werkwoord en onderwerp van plaats: de persoonsvorm blijft op de tweede plaats.",
      examples: [
        { nl: "Morgen ga ik naar Antwerpen.", en: "Tomorrow I am going to Antwerp." },
        { nl: "Daarom bel ik je later.", en: "That is why I will call you later." },
      ],
    },
    {
      ...by,
      type: "grammar",
      level: "A2",
      tags: ["werkwoorden"],
      source: "manual",
      title: "Scheidbare werkwoorden",
      summary: 'Voorvoegsel gaat naar het einde van de zin: "Ik bel je morgen op."',
      explanation:
        "Bij een scheidbaar werkwoord staat het voorvoegsel los achteraan in de hoofdzin. In een bijzin en bij het voltooid deelwoord komt het weer vast: opgebeld.",
      examples: [
        { nl: "Ik bel je morgen op.", en: "I will call you tomorrow." },
        { nl: "Hij heeft me gisteren opgebeld.", en: "He called me yesterday." },
      ],
    },
    {
      ...by,
      type: "grammar",
      level: "A2",
      tags: ["tijden"],
      source: "file-upload",
      title: "Perfectum",
      summary: '"hebben" of "zijn" + voltooid deelwoord: "Ik heb gewerkt."',
      explanation:
        "Het perfectum beschrijft een afgeronde handeling. Kies 'zijn' bij verandering van plaats of toestand, anders 'hebben'. Het voltooid deelwoord staat achteraan.",
      examples: [
        { nl: "Ik heb gisteren hard gewerkt.", en: "I worked hard yesterday." },
        { nl: "Zij is naar huis gegaan.", en: "She has gone home." },
      ],
    },
    {
      ...by,
      type: "note",
      level: "A2",
      tags: ["uitspraak", "docent"],
      source: "manual",
      title: "Uitspraaktips van de docent",
      body: "De 'g' en 'ch' klinken hetzelfde (stemloos), behalve in leenwoorden zoals 'garage'. De 'ui' is een aparte klank — niet 'oe' en niet 'au'. Oefen korte zinnen hardop en let op de klemtoon: die ligt meestal op de eerste lettergreep, maar niet bij woorden met 'be-', 'ge-', 'ver-' of 'ont-'.",
    },
  ] as (typeof knowledgeItems.$inferInsert)[];
}

/** The 10th item — a reading linking back to three of the vocabulary rows
 * above by their real (DB-generated) ids, matching the former mock's
 * `vocabularyIds`. */
function demoReadingItem(
  groupId: string,
  ownerId: string,
  vocabularyIds: string[],
): typeof knowledgeItems.$inferInsert {
  return {
    groupId,
    addedBy: ownerId,
    type: "reading",
    level: "A2",
    tags: ["reistekst", "dagelijks leven"],
    source: "manual",
    title: "Een dagje Antwerpen",
    body: "We gingen af en toe naar Antwerpen voor een dagje uit. De trein vanuit Rotterdam duurde ongeveer een uur. We moesten wel rekening houden met de drukte op zaterdag. In de stad liepen we langs de Schelde en dronken we koffie op een gezellig terras. 's Middags spraken we af met een vriendin bij het Centraal Station, een van de mooiste stations van Europa.",
    wordCount: 64,
    summary: "reistekst met dagelijkse woordenschat",
    vocabularyIds,
  } as typeof knowledgeItems.$inferInsert;
}

/** A handful of demo study runs for the seed owner, spread over ~2 weeks so
 * the profile Progress section isn't empty on a fresh dev DB / first preview
 * deploy. Idempotent: main() only inserts these when the owner has none. */
function demoStudyRuns(
  groupId: string,
  userId: string,
): (typeof studyRuns.$inferInsert)[] {
  const day = (n: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    d.setUTCHours(18, 0, 0, 0);
    return d;
  };
  const run = (
    n: number,
    kind: "practice" | "exam",
    mode: string | null,
    scope: string,
    level: string | null,
    questionCount: number,
    correctCount: number,
  ): typeof studyRuns.$inferInsert => {
    const completedAt = day(n);
    const startedAt = new Date(completedAt.getTime() - 5 * 60_000);
    return { groupId, userId, kind, mode, scope, level, questionCount, correctCount, startedAt, completedAt };
  };
  return [
    run(13, "practice", "vocabulary", "all", null, 10, 6),
    run(10, "practice", "mixed", "today", null, 8, 7),
    run(7, "exam", null, "all", null, 20, 12),
    run(4, "practice", "grammar", "level", "A2", 10, 9),
    run(1, "exam", null, "review", null, 15, 11),
  ];
}

async function main() {
  // 1. Ensure the auth user exists and is confirmed.
  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  let user = list.users.find(
    (u) => u.email?.toLowerCase() === email!.toLowerCase(),
  );
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: email!,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
  }
  const userId = user!.id;

  // 2. Upsert the group by slug.
  const slug = slugify(groupName);
  let [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.slug, slug))
    .limit(1);
  if (!group) {
    [group] = await db
      .insert(groups)
      .values({ name: groupName, slug, createdBy: userId })
      .returning();
  }

  // 3. Upsert the owner profile + membership.
  await db
    .insert(profiles)
    .values({
      id: userId,
      displayName: email!.split("@")[0],
      initials: deriveInitials(email!),
      accent: deriveAccent(userId),
    })
    .onConflictDoNothing();

  await db
    .insert(groupMemberships)
    .values({ groupId: group.id, userId, role: "owner" })
    .onConflictDoNothing();

  // 4. Seed demo library content once — skip if this group already has any.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(knowledgeItems)
    .where(eq(knowledgeItems.groupId, group.id));
  if (count === 0) {
    const inserted = await db
      .insert(knowledgeItems)
      .values(demoKnowledgeItemsExceptReading(group.id, userId))
      .returning({ id: knowledgeItems.id, term: knowledgeItems.term });
    const idByTerm = (term: string) => inserted.find((r) => r.term === term)!.id;
    const vocabularyIds = [
      idByTerm("af en toe"),
      idByTerm("rekening houden met"),
      idByTerm("gezellig"),
    ];
    await db.insert(knowledgeItems).values(demoReadingItem(group.id, userId, vocabularyIds));
    console.log("Seeded 10 demo knowledge items (incl. 1 reading linked to 3 vocabulary items).");
  }

  // 5. Seed demo study history + a few review marks once.
  const [{ count: runCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(studyRuns)
    .where(eq(studyRuns.userId, userId));
  if (runCount === 0) {
    await db.insert(studyRuns).values(demoStudyRuns(group.id, userId));

    const vocab = await db
      .select({ id: knowledgeItems.id })
      .from(knowledgeItems)
      .where(eq(knowledgeItems.groupId, group.id))
      .limit(3);
    if (vocab.length > 0) {
      await db
        .insert(reviewMarks)
        .values(vocab.map((v) => ({ userId, groupId: group.id, knowledgeId: v.id })))
        .onConflictDoNothing();
    }
    console.log(`Seeded ${demoStudyRuns(group.id, userId).length} demo study runs + ${vocab.length} review marks.`);
  }

  console.log(
    `Seeded owner ${email} into group "${groupName}" (${group.id}).`,
  );
}

main()
  .then(async () => {
    await client.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    try {
      await client.end();
    } catch {
      // ignore
    }
    process.exit(1);
  });
