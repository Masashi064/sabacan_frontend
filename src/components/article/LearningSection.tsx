"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Shared shell for every section below the video (Quiz, Vocabulary,
// Transcript, Found a problem?) so they read as one consistent
// "learning page" instead of a grab-bag of unrelated UIs.
// Non-collapsible sections (Quiz) just render their children directly;
// collapsible ones (Vocabulary, Transcript, the report form) stay
// closed by default and make it obvious there's more to open.
//
// `bare` drops the outer Card border/shadow/padding, rendering just a
// section heading + toggle — for sections like Vocabulary where the
// content itself (word cards) should be the visual focus, not a card
// wrapped around another layer of cards.
// `contentOutside` renders the header inside a Card but places children
// below the Card rather than inside it — avoids card-within-card nesting
// when the children are themselves cards (e.g. vocabulary flip cards).
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
  bare = false,
  contentOutside = false,
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
  bare?: boolean;
  contentOutside?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const isOpen = !collapsible || open;

  const header = (
    <div className="flex flex-row flex-wrap items-start justify-between gap-3">
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2 text-base font-semibold leading-none">
          <span className="flex items-center gap-2">
            <span aria-hidden="true">{icon}</span>
            {title}
          </span>
          {titleRight ? (
            <span className="text-sm font-normal text-muted-foreground">{titleRight}</span>
          ) : null}
        </div>
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
    </div>
  );

  if (bare) {
    return (
      <div className="space-y-3">
        {header}
        {isOpen ? <div>{children}</div> : null}
      </div>
    );
  }

  if (contentOutside) {
    return (
      <div className="space-y-3">
        <Card>
          <CardHeader>{header}</CardHeader>
        </Card>
        {isOpen ? <div>{children}</div> : null}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>{header}</CardHeader>

      {isOpen ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}
