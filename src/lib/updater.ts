import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'svelte-sonner';
import type { TFnType, DefaultParamType, TranslationKey } from '@tolgee/svelte';
import { info } from '@tauri-apps/plugin-log';

export const updateApp = async (t: TFnType<DefaultParamType, string, TranslationKey>) => {
  const update = await check();
  if (update) {

    toast.info(t('update_found', {
      version: update.version,
      date: update.date,
      body: update.body
    }), {
      duration: 5000
    });

    let downloaded = 0;
    let contentLength = 0;
    // alternatively we could also call update.download() and update.install() separately
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength ?? 0;
          info(`started downloading ${event.data.contentLength} bytes`);
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          info(`downloaded ${downloaded} from ${contentLength}`);
          break;
        case 'Finished':
          info('download finished');
          break;
      }
    });

    toast.info(t('update_success_restart'), {
      duration: undefined,
      action: {
        label: t("update_success_restart_btn"),
        onClick: async () => {
          await relaunch();
        }
      },
      cancel: {
        label: t("update_success_restart_cancel")
      }
    });
  }
}
