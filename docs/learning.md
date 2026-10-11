# Confidence and focused study

For both multiple-choice and hotspot questions, select Guessing / Unsure / Confident before submitting. Correctness controls the quiz score. Confidence controls review priority, so a correct guess still needs confirmation. Answers save immediately even if you leave the quiz unfinished or disable session resume.

Review order is confident errors, other misses, correct guesses, then uncertain correct answers. The dashboard counts each question's latest independent answer and shows the number of distinct questions tried, available coverage, recent misses, confident errors, uncertain correct answers, and last practice date. Old quiz averages remain under Domain score history.

Immediate **Retry wrong answers** sessions do not replace independent evidence. A later regular or focused session can update that evidence. Repeatedly getting one question right does not prove the whole concept is understood. A group is marked **Retained in practice** only when all its available questions (at least three distinct questions) have confident correct checks on two separate UTC dates after their last miss. It is a conservative practice indicator, not a prediction of certification exam success. Groups with fewer than three questions show limited evidence, even when every answer is correct.

Without known weaknesses, focused practice samples across domains and concepts. With weaknesses, it chooses up to ten questions from the three highest-priority concepts, favoring confident errors and unseen sibling questions. **Practice this area** restricts the pool to one concept. Small concepts can produce fewer than ten questions. There is no spaced-review scheduler in this release.

SC-500 questions carry `conceptId` and `conceptName`; see [the full mapping](concepts.md). These learning groups do not replace official `objectiveId` metadata. Other loaded exams fall back to domain + topic groups. Changing question text, choices, answer, or hotspot regions changes its revision fingerprint. Older answer events stay in the backup but stop contributing to the current question's focus assessment.

Home distinguishes **Continue quiz** from **Continue focused practice**. Starting a focused session preserves the regular quiz. Starting a new session in the same mode replaces that mode's resumable slot after the new quiz starts; the previous submitted answers remain in the learning log. The results screen recommends five focus areas, while Progress lists the full concept view.

Timeouts lower the quiz score but unanswered questions are not recorded as knowledge errors. Only submitted answers create learning evidence. A completed quiz's history uses its stable session ID, so returning to results does not create another attempt.
