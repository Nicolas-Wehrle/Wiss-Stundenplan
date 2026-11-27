# winget (Windows Package Manager)

With winget, Windows users can install and update the desktop app from the command line:

```
winget install SeverinWehrle.ErixStundenplan
winget upgrade SeverinWehrle.ErixStundenplan
```

It uses the normal installer from the GitHub release (`WISS.Stundenplan_<version>_x64-setup.exe`, per user, no admin). The app's own updater keeps working too.

## First version (once, by hand)

`1.14.0/` holds the manifests for the first version. They pass `winget validate --manifest "desktop app/winget/1.14.0"`.

1. Fork https://github.com/microsoft/winget-pkgs.
2. Put the four files into `manifests/s/SeverinWehrle/ErixStundenplan/1.14.0/` in your fork and open a pull request against `microsoft/winget-pkgs` (title: "New package: SeverinWehrle.ErixStundenplan version 1.14.0").
3. You sign Microsoft's contributor agreement once (a bot comment in the pull request). Automatic checks run, then a moderator merges it, usually within a few days.

## Later versions (automatic)

`.github/workflows/winget.yml` runs after every release, once the desktop build has added the Windows installer. It opens the pull request to winget-pkgs for you. It needs:

- the package already in winget (step above),
- your fork of `microsoft/winget-pkgs` (from step 1),
- the repository secret **`WINGET_TOKEN`**: a classic GitHub token with the scope `public_repo` (Settings › Developer settings › Personal access tokens › Tokens (classic)). Add it under the repository's Settings › Secrets and variables › Actions.

Without the secret, the workflow does nothing. To send a release by hand: Actions › winget › Run workflow.
