import { gun } from "./index";
import isequal from "lodash.isequal";

export function getOnce(path: string): Promise<any> {
  return new Promise((resolve) =>
    gun.get(path).once((data) => {
      resolve(data);
    })
  );
}

export async function save(path: string, data: any) {
  const old = await getOnce(path);
  if (old) {
    delete old._;
  }
  console.log("update", path);
  return new Promise((resolve) => {
    gun.get(path).put(data, (ack) => {
      if (ack.err && !Number.isInteger(ack.err)) {
        throw new Error(ack.err);
      }
      resolve(data);
    });
  });
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
