---
name: orca-chat-checklist
description: Give the user a shared checklist in this Orca chat that both of you can tick, such as
  a QA or verification list. Use when the user asks for a checklist, QA list or things to test.
user-invocable: false
---

# Shared checklist in an Orca chat

Orca shows a Checklist card when your reply contains a fenced block with the info string
`orca-checklist`. Both you and the user can check items; the user can add a note and screenshots
to each item.

## Writing the list

````
```orca-checklist
title: QA preview build
- [ ] Chat summary opens from the menu on the phone
- [x] Plan card shows progress
```
````

- One item per line, `- [ ] text` or `- [x] text`; an optional `title:` line first. At most 100
  items, each one short and testable.
- To update the list, write the whole block again in a later reply. Items are matched by their
  text, so keep the wording of items you are not changing. Mark an item `[x]` when you verified it
  yourself, or `[ ]` to ask the user to test it again.
- Only the latest block is shown. Don't repeat the block when nothing changed.

## Reading the user's progress

When the user changed the list, their next message starts with an `<orca-checklist-update>` block
listing each item they checked or unchecked, their notes, and the path of each screenshot on this
machine. Open a screenshot with your file or image tools when it matters. Act on failures the user
reports, and say which items you looked at.
