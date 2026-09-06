PYTHON ?= python
.PHONY: install dev test lint format seed reset build up down zip
install dev test lint format seed reset build up down zip:
	$(PYTHON) scripts/manage.py $@
