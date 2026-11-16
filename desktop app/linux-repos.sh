#!/usr/bin/env bash
# Builds the Linux package repositories for the website (GitHub Pages), so Fedora/openSUSE (dnf)
# and Ubuntu/Debian/Mint (apt) update the desktop app together with the rest of the system.
#
#   linux-repos.sh <folder with the .rpm and .deb> <site folder> <site address>
#
# Needs: createrepo_c, apt-ftparchive (apt-utils), rpmsign (rpm), gpg with the repo key imported.
# Writes into <site folder>:
#   wiss-stundenplan.asc   public key (users' systems check every update against it)
#   rpm/                   signed .rpm + repodata (signed repomd.xml)  → wiss-stundenplan.repo
#   apt/                   .deb + Packages + signed Release/InRelease → wiss-stundenplan.list
# Used by .github/workflows/pages.yml.
set -euo pipefail
pkgs="$1"; site="$2"; url="${3%/}"
shopt -s nullglob
rpms=("$pkgs"/*.rpm); debs=("$pkgs"/*.deb)
if [ ${#rpms[@]} -eq 0 ] && [ ${#debs[@]} -eq 0 ]; then echo "no Linux packages yet, skipping the repositories"; exit 0; fi
key=$(gpg --list-secret-keys --with-colons | awk -F: '/^fpr/ {print $10; exit}')
[ -n "$key" ] || { echo "no signing key imported" >&2; exit 1; }
mkdir -p "$site"
gpg --armor --export "$key" > "$site/wiss-stundenplan.asc"

if [ ${#rpms[@]} -gt 0 ]; then
  mkdir -p "$site/rpm"
  for f in "${rpms[@]}"; do
    v=$(rpm -qp --qf '%{VERSION}-%{RELEASE}.%{ARCH}' "$f")
    cp "$f" "$site/rpm/wiss-stundenplan-$v.rpm"
  done
  rpmsign --define "_gpg_name $key" --define "_openpgp_sign_id $key" --addsign "$site"/rpm/*.rpm
  createrepo_c --quiet "$site/rpm"
  gpg --batch --yes --local-user "$key" --detach-sign --armor "$site/rpm/repodata/repomd.xml"
  cat > "$site/wiss-stundenplan.repo" <<EOF
[wiss-stundenplan]
name=WISS Stundenplan
baseurl=$url/rpm
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=$url/wiss-stundenplan.asc
EOF
fi

if [ ${#debs[@]} -gt 0 ]; then
  mkdir -p "$site/apt"
  for f in "${debs[@]}"; do
    v=$(dpkg-deb -f "$f" Version); a=$(dpkg-deb -f "$f" Architecture)
    cp "$f" "$site/apt/wiss-stundenplan_${v}_${a}.deb"
  done
  (
    cd "$site/apt"
    apt-ftparchive packages . > Packages
    gzip -9kf Packages
    apt-ftparchive -o APT::FTPArchive::Release::Origin="WISS Stundenplan" -o APT::FTPArchive::Release::Label="WISS Stundenplan" release . > Release
    gpg --batch --yes --local-user "$key" --clearsign -o InRelease Release
    gpg --batch --yes --local-user "$key" -abs -o Release.gpg Release
  )
  gpg --export "$key" > "$site/wiss-stundenplan.gpg"   # binary key for apt's signed-by
  echo "deb [signed-by=/usr/share/keyrings/wiss-stundenplan.gpg] $url/apt ./" > "$site/wiss-stundenplan.list"
fi

# one command each, shown on the website and in the README
cat > "$site/linux.sh" <<EOF
#!/bin/sh
# WISS Stundenplan: adds the app's package source and installs it. Updates then come with the system updates.
set -e
get() { if command -v curl >/dev/null 2>&1; then sudo curl -fsSL -o "\$2" "\$1"; else sudo wget -qO "\$2" "\$1"; fi; }
if command -v dnf >/dev/null 2>&1; then
  get $url/wiss-stundenplan.repo /etc/yum.repos.d/wiss-stundenplan.repo
  sudo dnf install -y wiss-stundenplan
elif command -v zypper >/dev/null 2>&1; then
  sudo zypper --non-interactive addrepo --refresh $url/wiss-stundenplan.repo
  sudo zypper --non-interactive --gpg-auto-import-keys install wiss-stundenplan
elif command -v apt-get >/dev/null 2>&1; then
  get $url/wiss-stundenplan.gpg /usr/share/keyrings/wiss-stundenplan.gpg
  get $url/wiss-stundenplan.list /etc/apt/sources.list.d/wiss-stundenplan.list
  sudo apt-get update
  sudo apt-get install -y wiss-stundenplan
else
  echo "No dnf, zypper or apt found. Take the AppImage from https://github.com/Nicolas-Wehrle/Wiss-Stundenplan/releases/latest" >&2
  exit 1
fi
echo "Installed. Find WISS Stundenplan in your app menu."
EOF
echo "Linux repositories ready in $site"
