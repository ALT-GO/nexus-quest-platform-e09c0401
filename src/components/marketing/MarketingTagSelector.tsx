import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Tag, X } from "lucide-react";
import {
  useMarketingTags,
  useTaskTags,
  useCreateMarketingTag,
  useToggleTaskTag,
  MarketingTag,
} from "@/hooks/use-marketing-tags";

const TAG_COLORS = [
  "221 83% 53%",
  "142 71% 45%",
  "0 84% 60%",
  "280 67% 55%",
  "25 95% 53%",
  "199 89% 48%",
  "326 80% 50%",
  "45 93% 47%",
];

interface Props {
  taskId: string;
}

export function MarketingTagSelector({ taskId }: Props) {
  const { data: allTags } = useMarketingTags();
  const { data: taskTags } = useTaskTags(taskId);
  const createTag = useCreateMarketingTag();
  const toggleTag = useToggleTaskTag();
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);

  const taskTagIds = new Set((taskTags || []).map((t) => t.id));

  const handleCreateAndAdd = async () => {
    if (!newTagName.trim()) return;
    const result = await createTag.mutateAsync({ name: newTagName.trim(), color: selectedColor });
    toggleTag.mutate({ taskId, tagId: result.id, action: "add" });
    setNewTagName("");
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {(taskTags || []).map((tag) => (
          <Badge
            key={tag.id}
            className="text-xs gap-1 cursor-pointer"
            style={{ backgroundColor: `hsl(${tag.color})`, color: "#fff" }}
            onClick={() => toggleTag.mutate({ taskId, tagId: tag.id, action: "remove" })}
          >
            {tag.name}
            <X className="h-2.5 w-2.5" />
          </Badge>
        ))}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <Tag className="h-3 w-3" /> Adicionar Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-3" align="start">
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {(allTags || []).map((tag) => {
              const isActive = taskTagIds.has(tag.id);
              return (
                <button
                  key={tag.id}
                  className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors ${isActive ? "bg-accent" : ""}`}
                  onClick={() =>
                    toggleTag.mutate({ taskId, tagId: tag.id, action: isActive ? "remove" : "add" })
                  }
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: `hsl(${tag.color})` }}
                  />
                  <span className="flex-1 truncate">{tag.name}</span>
                  {isActive && <span className="text-xs text-primary">✓</span>}
                </button>
              );
            })}
            {(!allTags || allTags.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhuma tag criada</p>
            )}
          </div>
          <div className="border-t pt-2 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Criar nova tag</p>
            <Input
              placeholder="Nome da tag"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateAndAdd()}
              className="h-8 text-sm"
            />
            <div className="flex gap-1">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  className={`h-5 w-5 rounded-full border-2 transition-all ${selectedColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: `hsl(${c})` }}
                  onClick={() => setSelectedColor(c)}
                />
              ))}
            </div>
            <Button size="sm" className="w-full" onClick={handleCreateAndAdd} disabled={!newTagName.trim()}>
              <Plus className="h-3 w-3 mr-1" /> Criar e Adicionar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
