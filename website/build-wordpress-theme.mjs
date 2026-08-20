import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const target = join(root, "wordpress-theme", "serve-all-sports");

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(join(root, "assets"), join(target, "assets"), { recursive: true });

let html = await readFile(join(root, "index.html"), "utf8");
html = html
  .replace("<!doctype html>", '<?php /** Serve All Sports front page. */ $theme_uri = esc_url(get_template_directory_uri()); ?>\n<!doctype html>')
  .replace('<html lang="en">', '<html <?php language_attributes(); ?>>')
  .replace('<meta charset="UTF-8" />', '<meta charset="<?php bloginfo(\'charset\'); ?>" />')
  .replace('<body>', '<body <?php body_class(); ?>>\n    <?php wp_body_open(); ?>')
  .replace('content="assets/hero-matchday.jpg"', 'content="<?php echo $theme_uri; ?>/assets/hero-matchday.jpg"')
  .replace('href="favicon.svg"', 'href="<?php echo $theme_uri; ?>/favicon.svg"')
  .replace('href="site.webmanifest"', 'href="<?php echo $theme_uri; ?>/site.webmanifest"')
  .replace('    <link rel="stylesheet" href="styles.css" />\n', "")
  .replace('    <script src="script.js" defer></script>\n', "")
  .replaceAll('src="assets/', 'src="<?php echo $theme_uri; ?>/assets/')
  .replace("  </head>", "    <?php wp_head(); ?>\n  </head>")
  .replace("  </body>", "    <?php wp_footer(); ?>\n  </body>");

const css = await readFile(join(root, "styles.css"), "utf8");
const themeHeader = `/*
Theme Name: Serve All Sports Malawi
Theme URI: https://sasmw.com/
Author: Serve All Sports
Description: Premium Malawi football fixtures and verified ticketing website.
Version: 1.0.0
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Text Domain: serve-all-sports
*/

`;

const functionsPhp = `<?php
/** Theme setup and assets. */
if (!defined('ABSPATH')) { exit; }

function sas_theme_setup() {
    add_theme_support('post-thumbnails');
    add_theme_support('html5', array('search-form', 'gallery', 'caption', 'style', 'script'));
    add_theme_support('responsive-embeds');
}
add_action('after_setup_theme', 'sas_theme_setup');

function sas_enqueue_assets() {
    $version = wp_get_theme()->get('Version');
    wp_enqueue_style('sas-style', get_stylesheet_uri(), array(), $version);
    wp_enqueue_script('sas-site', get_template_directory_uri() . '/script.js', array(), $version, true);
}
add_action('wp_enqueue_scripts', 'sas_enqueue_assets');

function sas_remove_emoji_assets() {
    remove_action('wp_head', 'print_emoji_detection_script', 7);
    remove_action('wp_print_styles', 'print_emoji_styles');
}
add_action('init', 'sas_remove_emoji_assets');
`;

const themeJson = {
  "$schema": "https://schemas.wp.org/trunk/theme.json",
  version: 3,
  settings: {
    color: {
      palette: [
        { slug: "ink", color: "#09120f", name: "Ink" },
        { slug: "red", color: "#ee2b20", name: "Match Red" },
        { slug: "lime", color: "#d9f950", name: "Kickoff Lime" },
        { slug: "paper", color: "#f6f4ee", name: "Paper" }
      ]
    },
    layout: { contentSize: "1180px", wideSize: "1380px" }
  }
};

const readme = `# Serve All Sports Malawi WordPress Theme

## Installation

1. Zip the \`serve-all-sports\` folder if it is not already packaged.
2. In WordPress, open **Appearance → Themes → Add New → Upload Theme**.
3. Upload the ZIP, install, and activate it.
4. In **Settings → Reading**, select “Your latest posts”; the theme supplies the ticketing front page directly.
5. Clear the GoDaddy/WordPress cache and verify HTTPS.

Back up the existing sasmw.com installation before activation. Ticket checkout, live inventory, payments, QR issuance, and newsletter submission are front-end demonstrations until connected to production services.
`;

await Promise.all([
  writeFile(join(target, "index.php"), html),
  writeFile(join(target, "front-page.php"), html),
  writeFile(join(target, "style.css"), themeHeader + css),
  cp(join(root, "script.js"), join(target, "script.js")),
  cp(join(root, "favicon.svg"), join(target, "favicon.svg")),
  cp(join(root, "site.webmanifest"), join(target, "site.webmanifest")),
  cp(join(root, "assets", "hero-matchday.jpg"), join(target, "screenshot.jpg")),
  writeFile(join(target, "functions.php"), functionsPhp),
  writeFile(join(target, "theme.json"), JSON.stringify(themeJson, null, 2) + "\n"),
  writeFile(join(target, "README.md"), readme)
]);

console.log(`WordPress theme built at ${target}`);
