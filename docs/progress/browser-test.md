# browser-test

Goal: make npm run test:browsers pass.
Cause: throwaway home lacks @soffits/dsh-ui-kit (client injects uiKit; page waits for it) -> blank main.
Next: harness adds kit; run suite; fix share check.
Also: tests used .vsync-nav (gone since 0.6.x) -> .vsync-pageTabs. Iterating on further drift; log /tmp/browser-run.log
Done so far: kit install in harness; .vsync-nav->.vsync-pageTabs; shelf is library cards now (book flows incl. share check pass). Next: room flows drift (avatarStack etc.)
