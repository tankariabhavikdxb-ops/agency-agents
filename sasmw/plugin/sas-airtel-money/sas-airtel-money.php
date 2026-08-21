<?php
/**
 * Plugin Name:       Serve All Solutions – Airtel Money Gateway for WooCommerce
 * Plugin URI:        https://sasmw.com
 * Description:       Accept football match ticket payments via Airtel Money (Airtel Malawi)
 *                    using the Airtel Africa Open API (USSD push + webhook confirmation).
 * Version:           1.0.0
 * Author:            Serve All Solutions Limited
 * Author URI:        https://sasmw.com
 * License:           GPL-2.0-or-later
 * Text Domain:       sas-airtel-money
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * WC requires at least: 7.0
 * WC tested up to:   8.9
 *
 * @package SAS_Airtel_Money
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

define( 'SAS_AIRTEL_VERSION', '1.0.0' );
define( 'SAS_AIRTEL_PLUGIN_FILE', __FILE__ );
define( 'SAS_AIRTEL_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'SAS_AIRTEL_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'SAS_AIRTEL_GATEWAY_ID', 'sas_airtel_money' );
define( 'SAS_AIRTEL_WEBHOOK_KEY', 'sas_airtel_money' ); // WC_API key part of /wc-api/sas_airtel_money

/**
 * Declare HPOS compatibility (WooCommerce high-performance order storage).
 */
add_action( 'before_woocommerce_init', function () {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
	}
} );

/**
 * Load plugin files once WooCommerce is available.
 */
add_action( 'plugins_loaded', 'sas_airtel_init', 20 );

function sas_airtel_init() {
	// Require WooCommerce.
	if ( ! class_exists( 'WC_Payment_Gateway' ) ) {
		add_action( 'admin_notices', 'sas_airtel_wc_missing_notice' );
		return;
	}

	require_once SAS_AIRTEL_PLUGIN_DIR . 'includes/class-sas-airtel-money-api.php';
	require_once SAS_AIRTEL_PLUGIN_DIR . 'includes/class-sas-airtel-money-eticket.php';
	require_once SAS_AIRTEL_PLUGIN_DIR . 'includes/class-sas-airtel-money-gateway.php';
	require_once SAS_AIRTEL_PLUGIN_DIR . 'includes/class-sas-airtel-money-webhook.php';

	// Register the gateway with WooCommerce.
	add_filter( 'woocommerce_payment_gateways', 'sas_airtel_add_gateway' );
	function sas_airtel_add_gateway( $gateways ) {
		$gateways[] = 'SAS_Airtel_Money_Gateway';
		return $gateways;
	}

	// Load checkout JS + styles.
	add_action( 'wp_enqueue_scripts', 'sas_airtel_enqueue_checkout_assets' );

	// Add "Airtel Money" phone field to checkout (via gateway's field method).
	// Keep classes loaded.
	SAS_Airtel_Money_Webhook::register();
}

/**
 * Admin notice when WooCommerce is missing.
 */
function sas_airtel_wc_missing_notice() {
	echo '<div class="notice notice-warning"><p><strong>SAS Airtel Money:</strong> WooCommerce must be installed and active.</p></div>';
}

/**
 * Enqueue checkout scripts/styles only on the checkout page.
 */
function sas_airtel_enqueue_checkout_assets() {
	if ( function_exists( 'is_checkout' ) && is_checkout() ) {
		wp_enqueue_script(
			'sas-airtel-checkout',
			SAS_AIRTEL_PLUGIN_URL . 'assets/js/checkout.js',
			array( 'jquery' ),
			SAS_AIRTEL_VERSION,
			true
		);
		wp_localize_script( 'sas-airtel-checkout', 'sasAirtel', array(
			'gatewayId' => SAS_AIRTEL_GATEWAY_ID,
		) );
	}
}

/**
 * On activation: record activation time (webhook endpoint uses WC-API, no rewrites needed).
 */
register_activation_hook( __FILE__, 'sas_airtel_activate' );
function sas_airtel_activate() {
	update_option( 'sas_airtel_activated', time() );
}
