---
title: Talks
description: Talks I gave - slides, recordings and what I took away from them.
publish: true
permalink: talks.md
template: projects
---

# Talks

Things I talked about on stage and in meetups - mostly about building with AI, engineering leadership, and the stuff I learned the hard way.

## [[migrations-and-AI.pdf|⏩ What AI changed about migrations (and what it didn't)]]

*TechLead Summit · October 2026 · Berlin · English*

**AI made building a migration cheap. Convincing people is still the expensive part, and it's still your job.**

Most of us let AI do the heavy lifting every day, so why do big migrations still stall? I compare a 2022 frontend migration at ResearchGate (React inside a 15-year-old PHP monolith) with a migration my team is running today. AI shrank the prototype and the implementation from weeks to an afternoon. Agreeing on the problem and earning trust still take as long as they always did.

### Why I gave this talk

While AI tools were writing code for the rest of us, my lead engineer was writing a long RFC by hand, building demo repos and running discussions. It felt like being back in the Stone Age, but he was right. After 15+ years as a contractor, in mobile and in platform leadership, I keep seeing migrations fail because of people, not technology. I wanted to show why AI doesn't change that, and how it can even make it worse.

### Key takeaways

1. **Do your homework before the first line of code.** Which pain are you solving, and who needs to trust you so your solution survives contact with reality?
2. **Write down the agreed problems, including what you won't solve.** AI can list problems forever. It can't make people agree on which ones count.
3. **Small makes trust possible.** Ship one tiny feature with a hard deadline to production. Risk doesn't disappear, it moves: code can be rolled back, trust can't.

- [[migrations-and-AI.pdf]]
- Recording: ⏳*waiting for it*
- [Event](https://www.nextappcon.com/techlead-summit)

## [⭐ How I designed, built and shipped STARlog](https://luma.com/qg7ni1r8)

*Bridge The Gap · Casual Breakfast · August 2026 · Remote · English*

**Where AI earned its place in a side project and where it was just along for the ride.**

STARlog turns rough spoken or written memories into interview-ready STAR stories. It started as a manual three-tool workflow: recorder, transcription, chat prompt. This talk shows how it became a shipped, local-first app built with Claude Code and a team of specialist agents.

### Why I gave this talk

I wanted hands-on experience with agentic workflows on a real product, not a toy example. My own job search gave me the problem. The rules were simple: build something useful, automate everything, and use AI inside the product, not only while building it. Showing others how to get started and find their own use cases was why I joined this event.

### Key takeaways

1. A clunky manual workflow is often the best product spec you'll get.
2. Specialist review agents (PM, Designer, Security, Senior Dev, Tester) keep a solo project disciplined.
3. Cloud vs. local AI is a trade-off: Gemini adds a free tier and voice input, while local Gemma adds full privacy but only takes text.

- [[STARlog.pdf]]
- [Event](https://luma.com/qg7ni1r8)
- [Try STARlog](https://starlog.stefanhoth.com) · [GitHub](https://github.com/stefanhoth/starlog)


## The ancient past (> 2018)

My speaking activities started much earlier. I've given a number of talks at developer meetups and conferences like DevFest and Droidcon. 
However, I was not good at record keeping back then. 😅
