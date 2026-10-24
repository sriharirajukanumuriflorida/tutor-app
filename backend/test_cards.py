from curriculum.validate import load_cards, load_placement, validate, validate_placement


def test_cards_valid():
    assert validate(load_cards()) == []


def test_placement_valid():
    assert validate_placement(load_cards(), load_placement()) == []


def test_dictation_hides_word():
    from curriculum.render import render_question
    q = {"type": "spell", "prompt": "Spell the word jump.", "answer": "jump", "accept": []}
    r = render_question(q)
    assert r["hide_answer"] and "jump" not in r["display"].lower()
    assert r["speech"].count("jump") == 2


def test_clue_prompt_is_shown():
    from curriculum.render import render_question
    q = {"type": "spell", "prompt": "Add ing to hop. Spell the new word.", "answer": "hopping", "accept": []}
    r = render_question(q)
    assert not r["hide_answer"] and r["display"] == q["prompt"]


def test_check_answer_normalizes():
    from curriculum.render import check_answer
    q = {"type": "count", "prompt": "", "answer": "3", "accept": ["three"]}
    assert check_answer(q, " Three. ") and check_answer(q, "3") and not check_answer(q, "4")
    s = {"type": "spell", "prompt": "", "answer": "jump", "accept": []}
    assert check_answer(s, "JUMP") and not check_answer(s, "jup")


def test_no_spell_answer_leaks_to_screen():
    from curriculum.render import render_question
    for c in load_cards():
        for q in c["questions"]:
            if q["type"] == "spell":
                r = render_question(q)
                if r["hide_answer"]:
                    assert q["answer"] not in r["display"].lower()


def test_seed_rows_match_cards():
    from curriculum.seed import build_rows
    from curriculum.validate import load_cards, load_placement
    cards, placement = load_cards(), load_placement()
    rows = build_rows(cards, placement)
    assert len(rows["concepts"]) == len(cards)
    assert len(rows["questions"]) == sum(len(c["questions"]) for c in cards)
    assert len(rows["placement_items"]) == len(placement)
    ids = {c["id"] for c in rows["concepts"]}
    assert all(p["prereq_id"] in ids for p in rows["concept_prereqs"])
    assert len({(q["concept_id"], q["idx"]) for q in rows["questions"]}) == len(rows["questions"])


def test_every_choice_question_has_options():
    from curriculum.render import check_answer, render_question
    for c in load_cards():
        for q in c["questions"]:
            if q["type"] in ("choose", "count"):
                r = render_question(q)
                assert sorted(r["options"]) == sorted(q["options"]) and q["answer"] in r["options"]
                assert check_answer(q, q["answer"])[0] if isinstance(check_answer(q, q["answer"]), tuple) else check_answer(q, q["answer"])
                for o in q["options"]:
                    if o != q["answer"]:
                        res = check_answer(q, o)
                        assert not (res[0] if isinstance(res, tuple) else res), (c["id"], q["prompt"], o)


def test_options_are_read_aloud_when_not_in_prompt():
    from curriculum.render import render_question
    q = {"type": "choose", "prompt": "What did she do first?", "answer": "Put dough in a pan",
         "options": ["Put dough in a pan", "Put it in the oven"], "accept": []}
    r = render_question(q)
    assert "Put it in the oven" in r["speech"] and "Put it in the oven" not in r["display"]
    q2 = {"type": "choose", "prompt": "Which rhymes: lake or lock?", "answer": "lake", "options": ["lake", "lock"], "accept": []}
    assert render_question(q2)["speech"] == q2["prompt"]
