import type { CartItem, Design } from "./catalog";

export type SavedStudio = { designs: Design[]; cart: CartItem[] };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("t-genie-studio", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("studio");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readStudio(): Promise<SavedStudio | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("studio", "readonly");
    const request = transaction.objectStore("studio").get("saved");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}
export async function writeStudio(value: SavedStudio) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("studio", "readwrite");
    transaction.objectStore("studio").put(value, "saved");
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}
