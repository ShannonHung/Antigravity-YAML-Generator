.PHONY: gen
gen:
	@./generate.sh

web:
	make -j 2 backend frontend

backend:
	cd file-editor/backend && .venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd file-editor/frontend && npm run dev
