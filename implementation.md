# Implementation Log: Skill-Tree Literacy Tutor (Grade 1-2)

Status: PHASE 1 IN PROGRESS. Only content files and a validator added; no app code changed yet.
Last updated: 2026-10-24

## 1. What we are building
Extend Aria (voice tutor, FastAPI backend, Angular frontend, Supabase DB) with a Grade 1-2 literacy curriculum.
The original request was a 20-section classroom curriculum prompt. We reshaped it into a voice-tutor-friendly system:

- Concepts ("tricks and tips") such as -ie/-igh "eye" sounds, silent-e, syllable clapping, FLOSS, soft c/g.
- Aria explains each concept aloud, then asks follow-up questions.
- Grade 1 content must go beyond 3-letter CVC words (the child is past that level).
- Classroom docs (lesson plans, rubrics, family letters) are a separate generated deliverable.

## 2. Current codebase (baseline)
- backend/prompt.py: fixed Grade 1 system prompt (3-4 letter words, math 1-20, 5-state flow).
- backend/routers/chat.py: /chat; evaluate_answer() guesses correctness from the model reply (weak).
- backend/services/db.py: Supabase client; `interactions` table (session_id, subject, correct).
- backend/routers/progress.py: GET /progress/{session_id}.
- frontend/src/app/tutor/*, services/api.service.ts: voice UI, calls /chat, /tts, /transcribe, /progress.

## 3. Decisions made
| # | Decision | Why |
|---|----------|-----|
| 1 | Voice-tutor-shaped subset, not the full 20-section dump | Most sections (worksheets, newsletters) do not fit one-child voice sessions |
| 2 | Skill tree + placement quiz | Child can skip what he knows; avoids baby-level content |
| 3 | Concepts stored as cards in Supabase | Edit without redeploy; per-child progress; queryable |
| 4 | Seed JSON kept in repo as source of truth | Version control, review, backup |
| 5 | Python scores answers; LLM only speaks | Replaces unreliable "Great try" heuristic |
| 6 | Classroom docs generated separately from the same cards | Reuse content |

## 4. Concept catalog (draft categories)
- Sound awareness: syllable clapping, rhyme, word families, segment/blend/swap phonemes.
- Vowel tricks: silent-e, "eye" spellings (-ie, -igh, -y, i_e, -ind/-ild), long a/e/o/u spellings, vowel teams (oo, ou/ow, oi/oy, au/aw), r-controlled (ar, or, er/ir/ur, war/work).
- Consonant tricks: soft c/g, ck, -tch, -dge, digraphs (sh ch th wh ph ng nk), silent letters (kn wr gn mb), blends incl. 3-letter.
- Spelling rules: FLOSS, 1-1-1 doubling, drop-e before -ing, y to i, plurals, no English word ends in v, q needs u.
- Word parts: syllable types, syllable division, prefixes/suffixes, three sounds of -ed, contractions, compounds, homophones, heart words.
- Comprehension and grammar: strategies, text features, capitalization/punctuation, noun/verb/adjective.

Caveat: web research was mostly blocked (403/stub pages). Catalog is from standard Orton-Gillingham, UFLI and Common Core foundational-skills knowledge. Needs review against a trusted source.

## 5. Design
### Concept card (JSON, seeded to DB)
id, grade_band, category, title, trick, explanation, examples[], exceptions[], prereqs[], questions[]
(question: type listen/say/spell/clap/choose, prompt, correct_answer, accepted_variants[], difficulty)

### Lesson loop (per concept)
Hook (trick) -> Explain (2-3 sentences) -> Model (example words) -> Check (3-5 questions, easy to hard) ->
Adapt (2 wrong: re-teach with new example; 4 right: harder word/exception) -> Mastery (>=80%) -> log "I can..." statement.
Mastered concepts return for spaced review.

### Database tables (migration SQL to be run by the user in Supabase; not applied automatically)
- concepts, concept_prereqs, questions
- child_profiles (id, name, grade)
- child_concept_progress (child_id, concept_id, status locked/learning/mastered, attempts, correct, last_seen)
- interactions: add concept_id, question_id

### Backend
- Selector: next concept by prereqs, mastery, spaced review.
- Placement quiz endpoint; answer-check endpoint (normalize text, accepted variants).
- prompt.py becomes a template; injects the active card; keeps plain-speech-only output rules (TTS).
- Remove the 3-4 letter word limit for English.

### Frontend
Child picker, placement flow, progress view. Mic left untouched (original behavior); letter tiles dropped.

## 6. Phases and status
| Phase | Work | Status |
|-------|------|--------|
| 1 | Draft 80-150 concept cards (JSON) | Batch 3 done and user-updated: 148 cards / 707 questions + 28 placement items. Needs human review |
| 1b | Display/speech split, answer check and question endpoints | Done and tested; used by the lesson panel on Aria's page |
| 2 | DB migration SQL + seed script | Done: migration run (with RLS) and cards seeded and verified in Supabase |
| 3 | Backend selector, placement, answer check, prompt template | Done and tested (22 tests, real-DB smoke test) |
| 4 | Aria greeting + name, placement, lessons, progress on the landing page | Built, `ng build` clean; not yet tried in a browser |
| 5 | Classroom docs from cards | Not started |
| 6 | Tests (selector, checker, card validation, build) | 22 backend tests pass; no frontend tests |

## 7. Open items and risks
- Verify card content accuracy (spelling rules and exceptions) against a trusted source.
- Confirm with user before running any DB migration.
- Replacing session_id with child profiles affects existing progress data.
- Voice spelling is out of scope for now: answers are typed. Mic code is unchanged.
- TTS pronunciation of letter patterns (ough, augh, ie) is untested; may need a phonetic `say` field.
- Placement quiz has no items for batch 3 cards yet.

### Known gaps (deferred, to be handled later)
Identity and access
- Two children with the same name share one record (the name is the only key).
- No login: `GET /children` and all lesson endpoints are open, so anyone can list names and read or write progress.

Lesson behaviour
- No reteach after two misses in a row. Wrong-answer feedback restates the trick and the child gets the next question.
- A page refresh restarts at the greeting and the name question (nothing is kept in the browser). A refresh in the middle of the placement quiz restarts the quiz.
- `say` questions (77) are still typed, and about half are fragile (word-part definitions, syllable splits).
- Spelling answers must be typed, and spoken answers only work for button questions. Voice spelling is out of scope.
- Pick-one questions have a 50% guess rate, so mastery is weaker evidence on those cards.

Content
- Card content is unverified against a trusted source and needs human review.
- No placement items for the 45 batch 3 cards.
- TTS pronunciation of letter patterns is untested.
- The DB `questions` table has no `options` or `answer_text` columns. The runtime reads the JSON, so nothing breaks.

Not tested
- No browser click-through of the Aria flow, and speech-recognition accuracy for names is unknown.
- No frontend unit tests.

Operations
- The free Supabase project pauses after inactivity (no weekly ping built).
- Local setup: `backend/.env` must hold `ELEVENLABS_API_KEY` in UPPERCASE (variable names are case-sensitive; a lowercase name made `/tts` return 500 and Aria silent). Fixed; TTS verified with a real call.
- backend/google-cloud-key.json is untracked: keep it out of git.

## 8. Change log
- 2026-10-24: Planning sessions. Reviewed repo, researched concepts, chose skill-tree + DB approach. Created this file and plan-v2 in session folder.

- 2026-10-24: Phase 1 batch 1. Added backend/curriculum/cards/*.json (sound_awareness 6, vowel_tricks 17, consonant_tricks 14, spelling_rules 9, word_parts 14, comprehension_grammar 12 = 70 cards, 274 questions). Question types: choose, spell, count, say, open (open = LLM-judged, no stored answer). Added backend/curriculum/validate.py (schema, unknown prereqs, cycles, empty answers) and backend/test_cards.py. Validator passes. pytest not installed locally; run `python3 curriculum/validate.py` from backend/.
  - Gaps to fill in next batch: placement-quiz items, more G2 cards (eigh/ey, -tion/-sion, -able/-ible, schwa, ough words, more homophones, possessives, commas), more G1 cards (letter-sound review, -ed/-ing practice, sight-word groups, vowel teams ie/ey, 'a' before l/w words), more questions per card (target 5-6).
  - Content needs human review (rules and exceptions); some words in open-ended answers are judged by Aria.

- 2026-10-24: Kid-language pass. Rewrote `trick` and `explain` on all 70 cards in short first-grade words.
- 2026-10-24: Feedback on every question. Each question now has `if_right` (praise + restate the trick, even when correct) and `if_wrong` (kind correction + correct answer, spelled letter by letter for spell questions + trick + retry). Validator requires both. Removed 43 spell prompts that leaked the answer (e.g. `: pie.` or letter lists). Lines are templated; Aria may rephrase them. Per-question custom feedback can override.
  - Known issue: some clue-only spell prompts are ambiguous (e.g. "very tall" could be tall or high). Review needed; add `accept` variants or rewrite.
  - Design: on 2 wrong answers Aria re-teaches with the card `explain` plus a new example before retrying.

- 2026-10-24: Revisited word_parts.json (14 cards). Rewrote trick/explain with short sentences and one action per card (cut the word, listen to the last sound). Replaced jargon in questions (split to cut, syllables to beats, open/closed to "says its name or short sound"). Fixed spoken `i_can` lines. Regenerated all feedback lines for this file.
  - TODO: same pass for the other 5 card files; add a checker for sentence length (about 8 words) and hard words.

- 2026-10-24: Kid-language pass completed on all 70 cards. Added backend/curriculum/readability.py (flags sentences over 12 words and hard words in trick/explain/i_can; skips words that are the card's own topic) and backend/curriculum/feedback.py (single source for if_right/if_wrong text; rerun after editing a trick). Replaced "plural" and "exception" in prompts with plain words. Remaining checker notes: caption/glossary on cg-text-features (taught terms, accepted).
  - Run: `python3 curriculum/validate.py` and `python3 -m curriculum.readability` from backend/.

- 2026-10-24: Card-by-card comprehension review of all 70 cards for a 6-year-old. Fixed: wrong instruction in sr-doubling (write the letter twice, not say it), crowded cards (ct-tch, ct-dge, sr-y-to-i, sr-i-before-e), undefined "short/long vowel" ("quick vowel" was later dropped, see below), "chunk", spoken-aloud confusions ("Say the in front of the word", "Say this"), vt-long-u (u vs oo). Feedback regenerated.
  - Open risk: TTS may mispronounce letter groups like "ck", "tch", "ie". Plan: add optional `say` field (phonetic spelling) per card/example, and test with the real TTS voice.
  - Still needs a human read-through by a parent/teacher; I cannot judge from the page how a real child reacts.

- 2026-10-24: Input and repeat. Mic is not reliable on all devices, so all answers (spelling and spoken-type questions) are typed. Frontend: (superseded: the `micEnabled` flag was reverted, see next entry). Placeholder now "Type your answer here...". Added "Say it again" button that replays the last TTS audio from a cached blob (no extra backend call). After Aria speaks, the reply text stays on screen instead of "Ready to continue!" so the child can still read the question. `ng build` passes.
  - Design impact: question types `say`/`choose`/`count` are answered by typing too; Python answer checker must normalize typed text (trim, lowercase, number words vs digits, accept variants). `if_wrong` can show the letters on screen.
  - Repeat currently replays the whole last reply (feedback + next question). Once the lesson engine returns a separate `question` field, repeat should replay only the question.

- 2026-10-24: Reverted the `micEnabled` flag per user: mic code and button are back to original behavior and must not be changed for now. Typed input and the repeat button remain.

- 2026-10-24: Phase 1 batch 2. Added 24 cards (G1: all-words, ea-short, y-says-ee, s-says-z, question words, names/capitals, visualizing, more heart words; G2: eigh/ey, ey-ee, tion, ough, schwa, possessives, root words, ly/ness, reading big words in parts, more homophones, leaf-leaves, retell, fact/opinion, verb tense, commas in lists, subject-verb). Total 94 cards, 444 questions. Added 1-2 extra questions to 30 existing cards. Added backend/curriculum/placement.json (28 items, one per probe concept, easy to hard; right answer marks that concept and its prerequisites known). Validator now checks placement items; test_cards.py has a placement test.
  - Typed-answer rules for the checker: lowercase and trim; case-based questions avoided (capital letters can't be checked); possessives accept without the apostrophe.
  - DESIGN ITEM: "dictation" spell prompts ("Spell the word jump.") would show the answer on screen because Aria's reply text is displayed. For spell questions the UI must hide or mask the target word (show only a speaker/repeat prompt, or "Spell the word you heard") while TTS still says it. Needs a separate `display` vs `speech` text field per question.
  - Open questions (type open) remain LLM-judged and are excluded from placement.

- 2026-10-24: Dropped my invented term "quick vowel". "Short vowel" is taught once in vt-short-vowels with picture words (a apple, e egg, i itch, o octopus, u umbrella); ck, tch, dge and FLOSS cards now say "short vowel" with one example word each (duck, catch, badge, e in egg). Prereqs guarantee the child has seen the term first. Feedback regenerated.

_Rule: every implementation step appends an entry to section 8 and updates section 6. Entries below were added after this rule line and are also part of the change log._

### Display/speech split (done: backend + API client)
- `curriculum/render.py`: `render_question` gives `speech` (TTS) and `display` (screen); dictation spell prompts hide the word on screen. `check_answer` normalizes typed answers.
- `routers/curriculum.py`: `GET /curriculum/question/{card_id}/{index}`, `POST /curriculum/check` (`reveal=true` counts as missed). Registered in `main.py`.
- `api.service.ts`: `getQuestion`, `checkAnswer`.
- Verified: pytest 6 passed; TestClient checks for correct, wrong, reveal, 404.
- Not yet wired into tutor UI (needs phase 3 lesson engine). Repeat button still replays last reply.

### Card batch 3 (done)
- Source: Wikipedia "English orthography" spelling-to-sound tables (vowel and consonant patterns). Other sites were blocked (403/404). Grammar and word-skill cards come from standard curriculum knowledge and need human review.
- Added 45 cards (94 -> 139), 215 questions: Y special letter, vowels/consonants, ABC order, first/last sounds, blending, alliteration; a_e, i_e, o_e, u_e, e_e, y_e; ui, oe, ie (middle), ear, air/are, eer/ere, ire/our, ould, augh, alk, wa, w-bossy ar/or, o says u; gh, x, qu, ture, sion, age, gu, silent t/h/s, tch exceptions; er/or, y ending, ment; a/an, pronouns, adverbs, irregular verbs, end marks, multiple meaning, days/months, number words.
- Hidden-display text changed to "Spell what Aria says." (the old text contained "listen", a card word, and tripped the leak test).
- Verified: validate.py OK, readability only notes accepted terms, pytest 6 passed.
- Not added yet: placement items for the new cards, and TTS pronunciation checks for letter patterns.

### Phase 2: database migration and seed (written, not run)
- `backend/db/migrations/001_curriculum.sql`: tables `concepts`, `concept_prereqs`, `questions` (key: concept_id + idx), `placement_items`, `child_profiles`, `child_concept_progress`; adds nullable `child_id`, `concept_id`, `question_idx` to `interactions` (old rows keep working). Uses IF NOT EXISTS, so it can be re-run.
- `backend/curriculum/seed.py`: validates cards, then upserts them. `python -m curriculum.seed --dry-run` prints row counts without touching the DB. Current JSON: 148 concepts, 133 prereq links, 707 questions, 28 placement items.
- Question addressing is by position, so reordering or inserting questions in a card shifts idx. Progress is tracked per concept, so this only affects `interactions.question_idx`.
- RLS is not enabled: unknown whether the backend uses the anon or service key; matches the existing `interactions` table. Decide before real children use it.
- Test added: `test_seed_rows_match_cards`.

- 2026-10-24: Phase 2 applied. Original Supabase project was restored by the user (no new project needed). Migration 001 run in the SQL editor with RLS enabled (backend uses the service_role key, which bypasses RLS; anon key cannot access these tables). Seeded with `python -m curriculum.seed`: 148 concepts, 133 prereqs, 707 questions, 28 placement items, verified by row count. Free projects pause after inactivity: consider a weekly ping.

### Phase 3: lesson engine (done, backend only)
- `backend/curriculum/engine.py` (pure logic, no DB): next-card selector, question picker, mastery and review rules.
  - Next card: due reviews first; else a card whose prerequisites are all mastered; finish started cards first, then lowest grade, then card order.
  - Mastered = at least 3 right and at least 70% of attempts right. Then reviewed after 3 days; a right review pushes it 7 days, a miss resets the card.
  - A card that is not clicking (8 attempts, not mastered) is parked for 1 day, then retried from zero.
  - Questions go easy to hard and cycle through the whole card.
  - Placement: a right answer marks the concept and all its prerequisites known (review in 7 days). Stops after 3 misses in a row; the app keeps the miss count.
- `backend/services/child_db.py`: `SupabaseStore` (real) and `MemoryStore` (tests). Answers are also logged to `interactions` with child_id, concept_id, question_idx (session_id = child id, subject = english).
- `backend/routers/lesson.py` (registered in main.py):
  - `POST/GET /children`, `GET /children/{id}/progress`
  - `GET /children/{id}/placement/{pos}`, `POST /children/{id}/placement/{pos}` {answer, misses}
  - `GET /children/{id}/next` returns the card, an intro (trick + explain, only the first time) and the question (`speech` / `display`)
  - `POST /children/{id}/answer` {concept_id, index, answer, reveal} returns correct, the feedback text and `mastered`
- (Replaced, see the open-questions entry below.)
- Cards are read from the repo JSON at runtime; the DB copies of cards are seeded but not read yet. The DB holds children and progress.
- Card load order is now teaching order (sound awareness first). Reseeded so `sort_order` matches.
- prompt.py: removed the 3-4 letter word limit and the Grade-1 word lists. The /chat flow is unchanged (greeting, name, math). `evaluate_answer` in chat.py is no longer used for English lessons once the UI switches over.
- Not done: reteach after two misses in a row (the wrong-answer feedback already restates the trick); the child picker, placement and lesson screens (Phase 4); no auth on the new endpoints (same as existing ones).
- Verified: pytest 19 passed; real-DB smoke test created a child, ran next/answer/progress, then deleted it.

### Open questions removed (done)
- Problem: 12 `open` questions on 8 cards had no right answer, so the earlier fix scored any typed text as correct. That was participation credit, not scoring. A further ~12 comprehension `say` questions expected a typed phrase ("put it in the oven") and would mark right answers wrong.
- Fix: all of them became pick-one questions: "One: ... Two: ... Type 1 or 2." The child types one digit. Accepted: the digit, the word (one/two) or the option text. Rewrote 24 questions in sa-y-special, sa-alliteration, cg-adjectives, cg-predicting, cg-sequence, cg-main-idea, cg-cause-effect, cg-visualizing, cg-retell, cg-story-elements, plus 1 placement item (cause/effect).
- New optional question field `answer_text` (e.g. "number two, Bees are helpful") used by feedback.py so Aria says the option, not just "two". Not stored in the DB table (cards are read from JSON at runtime).
- The `open` type is gone: the validator rejects it, and the participation-credit code in routers/lesson.py, routers/curriculum.py and render.py was removed. A test checks every question accepts its own answer and rejects nonsense.
- Trade-off: pick-one has a 50% guess rate, so mastery (3 right, 70%) is weaker evidence on these cards. Creative practice (predict, retell in your own words) stays with Aria's free chat, not scored.
- Still fragile (not changed): typed definitions and syllable splits in word_parts ("not happy", "rab bit"), and a few two-word answers. They have accepted variants but a child may still type something correct that is not matched.
- Reseeded the DB. pytest 20 passed, validator OK.

### Multiple-choice answers with a Submit button
- Every `choose` (264) and `count` (21) question now has an explicit `options` list in the JSON, and so do the matching placement items. The answer is always one of the options. The validator enforces this (2–5 options, no duplicates, answer included).
- The old "One: … Two: … Type 1 or 2" prompts are gone. The answer is now the option text, and the digit is still accepted.
- `render_question` returns `options`, shuffled on each fetch, except yes/no and numbers. If the options are not already in the prompt, the speech reads them aloud after the question, because the child is a weak reader. The display text does not repeat them.
- Fixed 5 messy auto-parsed option sets by hand (vt-wa, ct-silent-letters x2, wp-closed-open-syllables, cg-sentences) and 1 placement item (wp-homophones).
- Frontend: new `AnswerInputComponent` (`frontend/src/app/answer/`). Option buttons highlight the selection, and Submit stays disabled until one is picked. With no options it shows a typed box and Submit. It builds but is NOT used on any screen yet, because the lesson screen is Phase 4. The mic code is untouched.
- Still typed: all 345 `spell` questions (the spelling has to be typed) and 77 `say` questions (about half are fragile, e.g. word-part definitions and syllable splits).
- Not done: the DB `questions` table has no `options` column. The runtime reads the JSON, so nothing breaks. Add migration 002 only if the DB copy ever becomes the source.
- Tests: 22 passing (every choose/count question has valid options, wrong options are rejected, options are read aloud when not in the prompt).

### Phone / touch check
- All answer controls are real `<button>`s with click handlers, so they work by touch. Nothing depends on hover (the hover effects are cosmetic only).
- Bug found and fixed: `body { overflow: hidden }` stopped the page from scrolling, so on a phone the lesson panel (taller than the screen) would hide the Submit button. Body now scrolls vertically.
- Also changed: `100dvh` so the browser address bar does not cut the page; `touch-action: manipulation` on buttons (no double-tap zoom or delay); minimum 44-48px tap targets for answer buttons, Submit and the text links; the input stays at 16px+ so iOS does not zoom on focus; on small screens the avatar and mic shrink so more of the lesson fits.
- NOT verified on a real phone or an emulator (only `ng build`). Still to check by hand: iOS Safari sound after the first tap, the mic on iOS (it uses the recorder fallback, unchanged), and long options wrapping on narrow screens.

### Card rotation (one card no longer fills a session)
- Problem: the lesson showed only the first card ("How many beats in pumpkin?") until it was mastered (3 right at 70%), and all 5 of its questions are the same kind. Progress was saved correctly; it was repetitive by design.
- Fix (`engine.next_concept`): among the ready cards (prerequisites met, lowest grade then card order), take the first 3 and ask 2 questions on a card before moving to the next. Constants `MIX_WINDOW = 3`, `MIX_RUN = 2`. Mastery rules, review timing and prerequisites are unchanged, so a card now takes 2 or more visits to master. Due reviews still come first.
- Tests: 23 pass (new rotation test; the old "one card straight through" test was rewritten).
- Not changed: placement still starts with the beats item for each new child, and the first card still has to be learned or placed out of before its dependents open.

### Phase 4: lessons on Aria's landing page (built, not yet tried in a browser)
- Correction 2: my first greeting ("What is your name?") ignored Aria's backstory in `backend/prompt.py`. Restored: the opening line and the replies for Hari/Harry (Father), Arjun and Aryan (big sister) are copied word for word from STATE 1 and STATE 2 into constants at the top of `tutor.component.ts`. Other names get "Nice to meet you, <name>! Are you ready to have fun?". Aria then waits for a yes (STATE 3) before the lessons or placement start; "no / not now" gets a warm "come back anytime". The text is checked equal to prompt.py. The two copies must be kept in sync by hand.
- STATE 2 "any variation": names are matched as whole words, case-insensitive, with spelling and speech-recognition variants (Harry/Hary/Harie, Arjoon/Arjan, Aaryan/Aryann/Arian). Not matched on purpose: Harini, Harper, Mary, Ryan, Ariana, Aaron. The special speech plays every visit, new or returning. Hari, Arjun and Aryan each get their own child profile under the name Hari/Arjun/Aryan.
- STATE 3 restored (it had been skipped by mistake): after a yes, Aria asks "Should we jump into English or hop into math?" and waits (spoken or the two buttons). "No / not now" gets the warm "come back anytime" and goes back to waiting for a yes. English starts the placement quiz (new child) or lessons (returning child). Math has no curriculum yet, so it opens the old free chat with subject=math; Aria's LLM prompt handles it. Matching words: english/reading/spelling/phonics/jump and math/numbers/hop.
- Still not tried in a browser.
- Correction: the first Phase 4 build put a separate Learn tab on the landing page. That was wrong. The tabs are gone and `AppComponent` shows only Aria's page.
- Flow: Aria's page opens with a "Meet Aria" button (browsers need a tap before sound). Aria greets the child and asks "What is your name?". The child answers with the mic or by typing. `onName` strips "my name is / I'm / hello" and keeps up to 2 words. An existing name (case-insensitive) means "Welcome back" and lessons; a new name creates the child and starts the placement quiz.
- The lessons live in `LearnComponent` (`frontend/src/app/learn/`), now a panel inside Aria's page. It has no audio of its own: it emits `speak` and the tutor speaks through the existing TTS path, so the avatar animates and "Say it again" works. The greeting is spoken together with the first question so they do not overlap.
- Mic: `onMicClick`, `startListening`, `startRecording`, `stopRecording` are unchanged. Only `onUserSpoke` routes by phase: name -> `onName`; lesson -> `LearnComponent.heard()`; chat -> old behaviour. In a lesson a spoken answer is matched against the option buttons (number words work, e.g. "two"). Spelling questions must be typed, and Aria says so.
- Links in the panel: My stars, Chat with Aria (the old free chat with the Math/English pills, with a "Back to my lessons" link), and "Not <name>?" to start over.
- Buttons are locked while Aria is talking, because there is one shared audio element and a new clip would cut the old one off.
- Verified: `ng build` clean, name parsing checked in node, and the live backend (create child, placement, next) returned correct payloads. The test child was deleted afterwards.
- NOT verified: a click-through in a browser, speech-recognition accuracy for names, and how TTS says the letter patterns.
- Known gaps: two children with the same name share one record; `GET /children` is open, so anyone can list names (no auth yet); no reteach after two misses; no placement items for the 45 batch 3 cards; `say` questions are typed; a page refresh restarts at the greeting.
- Local setup: `backend/venv` (Python 3.12) replaced the broken `.venv`; run `source venv/bin/activate && uvicorn main:app --reload`, and `npx ng serve` in `frontend/`.
