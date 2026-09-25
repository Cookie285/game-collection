# Convenience targets (optional). Usage: make import CSV=~/Downloads/clz_games.csv
import:
	python3 scripts/gamecoll.py import "$(CSV)"
render:
	python3 scripts/gamecoll.py render
check:
	python3 scripts/gamecoll.py check
find:
	python3 scripts/gamecoll.py find $(Q)
.PHONY: import render check find
