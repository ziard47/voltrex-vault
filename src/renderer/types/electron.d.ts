import { VaultApi } from '../../preload/preload';

declare global {
  interface Window {
    vaultApi: VaultApi;
  }
}
