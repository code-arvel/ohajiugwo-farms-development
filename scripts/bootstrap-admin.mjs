// No environment file, provider client or network import: live effects remain disabled.
const help=`First-administrator maintainer command — local tests only.
Implemented command runner: prepare --email ADDRESS, issue/status/cancel --id ID;
each requires --confirm-project REF. Its injected dependencies are exercised by
npm run admin:test-first-admin. No passwords, tokens or links are command arguments.
Hosted execution is disabled until SQL, callback and delivery gates are verified.
`;
if(process.argv.length===3&&process.argv[2]==='--help')process.stdout.write(help);
else{process.stderr.write('Hosted bootstrap execution is disabled. Use --help or run the isolated local tests.\n');process.exitCode=1;}
