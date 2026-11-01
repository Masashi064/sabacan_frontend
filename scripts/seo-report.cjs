/* eslint-disable @typescript-eslint/no-require-imports */
// Uses existing linked CLI authentication. Never reads or prints credentials/evidence.
const {spawnSync}=require('node:child_process');
const result=spawnSync('npm',['exec','--yes','--package','supabase','--','supabase','db','query','--linked','--file','supabase/seo_report.sql'],{stdio:'inherit'});
process.exit(result.status??1);
