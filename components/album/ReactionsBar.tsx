import React from "react";
import ReactorPopover from "./ReactorPopover";
import ReactionPicker, { ReactionCategory } from "./ReactionPicker";
import { HeartIcon } from "../icons/HeartIcon";
import type { Reactor } from "../../lib/repos/reactionRepo";

export interface ReactionsBarProps {
  liked: boolean;
  likeCount: number;
  likeBusy: boolean;
  onToggleLike: () => void;
  reactions: { emoji: string; count: number; mine: boolean }[];
  hoveredEmoji: string | null;
  onChipEnter: (emoji: string) => void;
  onChipLeave: () => void;
  reactorMap: Record<string, Reactor[] | undefined>;
  reactorLoading: Record<string, boolean>;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  emojiQuery: string;
  onEmojiQueryChange: (v: string) => void;
  activeCat: string;
  onActiveCatChange: (key: string) => void;
  filteredEmojis: string[];
  categoryEmojis: string[];
  categories: ReactionCategory[];
  onPickEmoji: (emoji: string) => void;
}

export default function ReactionsBar(props: ReactionsBarProps) {
  const {
    liked, likeCount, likeBusy, onToggleLike,
    reactions, hoveredEmoji, onChipEnter, onChipLeave,
    reactorMap, reactorLoading,
    pickerOpen, onTogglePicker,
    emojiQuery, onEmojiQueryChange,
    activeCat, onActiveCatChange,
    filteredEmojis, categoryEmojis,
    categories,
    onPickEmoji,
  } = props;

  return (
    <div className="mt-2 relative flex items-center gap-3">
      <div className="flex items-center gap-1">
        <button
          aria-label={liked ? "いいね済み" : "いいね"}
          aria-pressed={liked}
          disabled={likeBusy}
          onClick={onToggleLike}
          className={`${liked ? "text-pink-600" : "fg-muted"} disabled:opacity-50`}
        >
          <HeartIcon filled={liked} size={20} />
        </button>
        <span className="text-xs fg-subtle">{likeCount}</span>
      </div>
      <div className="ml-4 flex items-center gap-2 flex-wrap">
        {reactions.filter(r => r.count > 0).map((r) => {
          const mine = r.mine;
          const count = r.count;
          return (
            <div key={r.emoji} className="relative" onMouseEnter={() => onChipEnter(r.emoji)} onMouseLeave={onChipLeave}>
              <button
                type="button"
                aria-label={`リアクション ${r.emoji}`}
                aria-pressed={mine}
                onClick={() => onPickEmoji(r.emoji)}
                className={`rounded border px-2 py-1 text-sm ${mine ? "border-blue-600 bg-page text-blue-700" : "border-base bg-page fg-muted"}`}
              >{r.emoji} <span className="text-xs">{count}</span></button>
              {hoveredEmoji === r.emoji && (
                <ReactorPopover emoji={r.emoji} users={reactorMap[r.emoji]} loading={reactorLoading[r.emoji]} />
              )}
            </div>
          );
        })}
        <button
          type="button"
          aria-label="リアクションを追加"
          onClick={onTogglePicker}
          className="px-1 text-lg leading-none fg-muted"
        >＋</button>
        <ReactionPicker
          open={pickerOpen}
          query={emojiQuery}
          onQueryChange={onEmojiQueryChange}
          activeCat={activeCat}
          onCatChange={onActiveCatChange}
          filteredEmojis={filteredEmojis}
          categoryEmojis={categoryEmojis}
          reactions={reactions}
          categories={categories}
          onPickEmoji={onPickEmoji}
          onClose={onTogglePicker}
        />
      </div>
    </div>
  );
}
