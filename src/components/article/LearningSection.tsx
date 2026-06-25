"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Shared shell for every section below the video (Quiz, Summary,
// Vocabulary, Transcript, Found a problem?) so they read as one
// consistent "learning page" instead of a grab-bag of unrelated UIs.
// Non-collapsible sections (Quiz, Summary) just render their children
// directly; collapsible ones (Vocabulary, Transcript, the report form)
// stay closed by default and make it obvious there's more to open.
export function LearningSection({
  icon,
  title,
  titleRight,
  meta,
  description,
  collapsible = false,
  defaultOpen = false,
  showLabel = "Show",
  hideLabel = "Hide",
  children,
}: {
  icon: string;
  title: string;
  titleRight?: React.ReactNode;
  meta?: string;
  description?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  showLabel?: string;
  hideLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const isOpen = !collapsible || open;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="flex-1 space-y-1">
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <span aria-hidden="true">{icon}</span>
              {title}
            </span>
            {titleRight ? (
              <span className="text-sm font-normal text-muted-foreground">{titleRight}</span>
            ) : null}
          </CardTitle>
          {meta ? <p className="text-sm font-medium">{meta}</p> : null}
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {collapsible ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <>
                {hideLabel} <ChevronUp className="ml-1 h-4 w-4" />
              </>
            ) : (
              <>
                {showLabel} <ChevronDown className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        ) : null}
      </CardHeader>

      {isOpen ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}
