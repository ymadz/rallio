require('dotenv').config({ path: 'web/.env.local' });

async function run() {
  const result = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/?apikey=${process.env.SUPABASE_SERVICE_ROLE_KEY}`);
  const json = await result.json();
  console.log("=== BOOKINGS ===");
  console.log(JSON.stringify(json.definitions.bookings?.properties, null, 2));
  console.log("\n=== RESERVATIONS ===");
  console.log(JSON.stringify(json.definitions.reservations?.properties, null, 2));
}
run();
