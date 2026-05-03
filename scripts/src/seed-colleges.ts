import { db, collegesTable } from "@workspace/db";

const colleges = [
  { name: "NMIMS University", domain: "nmims.edu", location: "Mumbai, Maharashtra" },
  { name: "Mithibai College", domain: "mithibai.edu", location: "Vile Parle, Mumbai" },
  { name: "KES Shroff College", domain: "kesshroff.edu", location: "Kandivali, Mumbai" },
  { name: "Thakur College of Science & Commerce", domain: "thakurcollege.net", location: "Kandivali, Mumbai" },
  { name: "St. Xavier's College", domain: "xaviers.edu", location: "Fort, Mumbai" },
  { name: "Jai Hind College", domain: "jaihindcollege.edu", location: "Churchgate, Mumbai" },
  { name: "HR College of Commerce & Economics", domain: "hrcollege.edu", location: "Churchgate, Mumbai" },
  { name: "SIES College", domain: "sies.edu", location: "Sion, Mumbai" },
  { name: "Sophia College for Women", domain: "sophiacollege.edu", location: "Breach Candy, Mumbai" },
  { name: "Wilson College", domain: "wilson.edu", location: "Chowpatty, Mumbai" },
];

async function seed() {
  console.log("Seeding colleges...");
  for (const college of colleges) {
    await db.insert(collegesTable).values(college).onConflictDoNothing();
    console.log(`  ✓ ${college.name}`);
  }
  console.log("Done!");
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
