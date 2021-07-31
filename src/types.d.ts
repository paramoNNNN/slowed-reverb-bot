import { Context, NarrowedContext } from "telegraf";
import * as tt from "telegraf/src/telegram-types";

type MountMap = {
  [T in tt.UpdateType]: Extract<tt.Update, Record<T, Record<string, unknown>>>;
} &
  {
    [T in tt.MessageSubType]: {
      message: Extract<tt.Update.MessageUpdate["message"], Record<T, unknown>>;
      update_id: number;
    };
  };

type MatchedContext<
  C extends Context,
  T extends tt.UpdateType | tt.MessageSubType
> = NarrowedContext<C, MountMap[T]>;

export type CTX = MatchedContext<Context & { match: RegExpExecArray }, "text">;
