// Builds the site for its public address and publishes the build to GitHub Pages.
//
//   npm run deploy -- <github-user> <repository>
//
// One-time setup: the repository exists on GitHub and Pages serves its gh-pages branch.
// Only the built site is pushed, and it replaces whatever was published before.

import { execFileSync, execSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';

const [user, repo] = process.argv.slice(2);
if (!user || !repo) {
  console.error('usage: npm run deploy -- <github-user> <repository>');
  process.exit(1);
}
const site = `https://${user}.github.io/${repo}/`;

// the link preview needs the final address baked in, so the build is always made here
execSync('npm run build', { stdio: 'inherit', env: { ...process.env, SITE_URL: site } });

const git = (...args) => execFileSync('git', args, { cwd: 'dist', stdio: 'inherit' });
writeFileSync('dist/.nojekyll', ''); // GitHub serves the files exactly as built
rmSync('dist/.git', { recursive: true, force: true });
git('init', '--quiet', '--initial-branch=gh-pages');
git('add', '--all');
// a no-reply address keeps a personal email out of the public history
git('-c', `user.name=${user}`, '-c', `user.email=${user}@users.noreply.github.com`, 'commit', '--quiet', '-m', 'Publish invitation');
git('push', '--force', `https://github.com/${user}/${repo}.git`, 'gh-pages');
rmSync('dist/.git', { recursive: true, force: true });

console.log(`\nPublished. ${site} updates within a minute or two.`);
