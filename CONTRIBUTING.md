# Contributing to MedicAssist

Thank you for your interest in contributing to **MedicAssist**.

MedicAssist is an offline, CPU-first AI application that converts unstructured medical notes into structured FHIR R4 JSON using Whisper.cpp and Phi-3 Mini.

## Development Workflow

1. Fork the repository.
2. Create a feature branch.

```bash
git checkout -b feature/your-feature
```

3. Make your changes.
4. Run all local checks.

```bash
npm run lint
npm run format
npm test
```

5. Commit using semantic commit messages.

Examples:

```text
feat: add offline audio recorder

fix: correct FHIR validation

docs: update user manual

refactor: simplify IndexedDB module
```

6. Push your branch.

```bash
git push origin feature/your-feature
```

7. Open a Merge Request.

---

## Code Style

* Use meaningful variable names.
* Keep functions modular.
* Follow ES6+ JavaScript standards.
* Format code before committing.
* Avoid unnecessary dependencies.

---

## Pull Request Checklist

* Code builds successfully.
* Linting passes.
* Tests pass.
* Documentation updated.
* No sensitive information committed.
* Feature works offline.

---

## Reporting Issues

Please include:

* Operating System
* Browser
* Steps to reproduce
* Expected behavior
* Actual behavior
* Screenshots (if applicable)

---

## License

By contributing, you agree that your contributions will be licensed under the project's GNU AGPL-3.0 License.
