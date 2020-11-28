import { gun } from "./index";

export function getOnce(path: string): Promise<any> {
  return new Promise((resolve) =>
    gun.get(path).once((data) => {
      resolve(data);
    })
  );
}

export async function getMany(path: string) {
  const list = await getOnce(path);
  if (!list) {
    return [];
  }
  const many = await Promise.all(
    Object.keys(list)
      .filter((key) => key !== "_")
      .map((key) => {
        return getOnce(list[key]["#"]);
      })
  );
  return many.filter((item) => item !== null);
}

export function watchMany<T>(path: string, callback: (data: T[]) => void) {
  gun.get(path).on((list) => {
    if (!list) {
      callback([]);
    }

    Promise.all(
      Object.keys(list)
        .filter((key) => key !== "_")
        .map((key) => {
          return getOnce(list[key]["#"]);
        })
    ).then(callback);
  });
}
