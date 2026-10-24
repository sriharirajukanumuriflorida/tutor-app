import re
from curriculum.validate import load_cards

MAX_WORDS = 12
HARD = {"syllable", "syllables", "consonant", "consonants", "digraph", "prefix", "suffix", "compound",
        "plural", "adjective", "noun", "verb", "synonym", "synonyms", "antonym", "antonyms", "phoneme",
        "sequence", "inference", "predict", "prediction", "character", "characters", "setting",
        "solution", "glossary", "caption", "heading", "homophone", "homophones", "exception", "exceptions",
        "contraction", "apostrophe", "separate", "compare", "compares", "comparing", "describing", "describes"}


def check(cards):
    out = []
    for c in cards:
        for field in ("trick", "explain", "i_can"):
            for s in re.split(r"(?<=[.!?])\s+", c[field]):
                words = re.findall(r"[A-Za-z']+", s)
                if len(words) > MAX_WORDS:
                    out.append(f"{c['id']}.{field}: long ({len(words)}): {s}")
                hard = {w.lower() for w in words} & HARD - set(re.findall(r"[a-z']+", c['title'].lower()))
                hard -= {w for w in hard if w[:5] in c['title'].lower()}
                if hard:
                    out.append(f"{c['id']}.{field}: hard {sorted(hard)}")
    return out


if __name__ == "__main__":
    issues = check(load_cards())
    print("\n".join(issues) or "OK")
    print(len(issues), "issues")
