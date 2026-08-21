<?php
/**
 * Uninstall handler — called by WordPress when the plugin is deleted.
 *
 * @package SAS_Airtel_Money
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Remove the payment gateway option.
delete_option( 'woocommerce_sas_airtel_money_settings' );

// Remove cached tokens.
global $wpdb;
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_sas_airtel_token_%' OR option_name LIKE '_transient_timeout_sas_airtel_token_%'" );

// Optionally remove the activation marker.
delete_option( 'sas_airtel_activated' );
