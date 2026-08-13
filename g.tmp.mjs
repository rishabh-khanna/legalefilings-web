process.loadEnvFile("/Users/rishabh/legalefilings-web/.env.local");
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {auth:{persistSession:false}});
const { data } = await sb.from("staff_tool_grants").select("tool_key, staff_id, profiles:staff_id(full_name, account_type)");
data.forEach(g => console.log(`${g.profiles?.full_name} (${g.profiles?.account_type})  ->  ${g.tool_key}`));
