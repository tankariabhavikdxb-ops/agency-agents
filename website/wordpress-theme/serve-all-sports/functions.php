<?php
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
