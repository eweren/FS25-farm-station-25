import { execSync } from 'child_process';

(
  () => {
    execSync(`tolgee push --api-key tgpak_grpwumlsnqzdondooi3tanbyg44di4lhg53gunlwoazwm --api-url https://tolgee.lila.glass/`);
    execSync(`tolgee pull --api-key tgpak_grpwumlsnqzdondooi3tanbyg44di4lhg53gunlwoazwm --api-url https://tolgee.lila.glass/`);
  })()