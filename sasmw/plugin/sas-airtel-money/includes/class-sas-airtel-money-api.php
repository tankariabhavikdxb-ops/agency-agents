<?php
/**
 * Airtel Money API client (Airtel Africa Open API).
 *
 * Handles:
 *  - Access token request
 *  - Payment request (USSD push to customer)
 *  - Payment status check
 *
 * NOTE: Airtel Africa endpoints/field names differ by country and over time.
 * The CONFIG block below is the ONLY place you should need to edit to match the
 * current Airtel API docs for Malawi:
 *   https://developers.airtel.africa/docs
 *
 * @package SAS_Airtel_Money
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class SAS_Airtel_Money_API {

	/**
	 * Build the API base URL for the current environment.
	 *
	 * @return string
	 */
	private static function base_url() {
		$gw = self::gateway();

		if ( 'yes' === $gw->get_option( 'test_mode' ) ) {
			$url = $gw->get_option( 'sandbox_api_base_url' );
			return $url ? rtrim( $url, '/' ) : 'https://sandbox.openapi.airtel.africa';
		}

		$url = $gw->get_option( 'live_api_base_url' );
		return $url ? rtrim( $url, '/' ) : 'https://openapi.airtel.africa';
	}

	/**
	 * @return SAS_Airtel_Money_Gateway
	 */
	private static function gateway() {
		return new SAS_Airtel_Money_Gateway();
	}

	/**
	 * Get an OAuth2 access token.
	 *
	 * @return string|WP_Error Access token or WP_Error.
	 */
	public static function get_access_token() {
		$gw    = self::gateway();
		$key   = $gw->get_option( 'client_id' );
		$secret = $gw->get_option( 'client_secret' );

		if ( empty( $key ) || empty( $secret ) ) {
			return new WP_Error( 'sas_airtel_missing_creds', __( 'Airtel Money Client ID / Secret not configured.', 'sas-airtel-money' ) );
		}

		// Cache the token in a transient for 50 minutes (Airtel tokens ~1h).
		$cache_key = 'sas_airtel_token_' . md5( $key . ':' . $secret );
		$cached    = get_transient( $cache_key );
		if ( $cached && is_string( $cached ) ) {
			return $cached;
		}

		// The token grant path is typically /auth/oauth2/token. Configure if different.
		$grant_path = $gw->get_option( 'token_path' ) ? $gw->get_option( 'token_path' ) : '/auth/oauth2/token';

		$response = wp_remote_post( self::base_url() . $grant_path, array(
			'headers' => array(
				'Content-Type'  => 'application/json',
				'Accept'        => 'application/json',
			),
			'body'    => wp_json_encode( array(
				'client_id'     => $key,
				'client_secret' => $secret,
				'grant_type'    => 'client_credentials',
			) ),
			'timeout' => 30,
		) );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 200 !== $code || empty( $body['access_token'] ) ) {
			return new WP_Error( 'sas_airtel_token_failed', sprintf( __( 'Airtel token request failed (HTTP %s): %s', 'sas-airtel-money' ), $code, wp_remote_retrieve_body( $response ) ) );
		}

		set_transient( $cache_key, $body['access_token'], 50 * MINUTE_IN_SECONDS );

		return $body['access_token'];
	}

	/**
	 * Initiate a USSD push payment request.
	 *
	 * @param float  $amount     Amount in MWK.
	 * @param string $msisdn     Customer Airtel Money number, e.g. +265991234567.
	 * @param string $reference  Unique order reference (we use WC order key + id).
	 *
	 * @return array|WP_Error Response body array or WP_Error.
	 */
	public static function request_payment( $amount, $msisdn, $reference ) {
		$gw    = self::gateway();
		$token = self::get_access_token();

		if ( is_wp_error( $token ) ) {
			return $token;
		}

		$transaction_id = 'SAS' . time() . wp_rand( 1000, 9999 );

		// Payment request path — configure to match current Airtel docs.
		$pay_path = $gw->get_option( 'payment_path' ) ? $gw->get_option( 'payment_path' ) : '/merchant/v2/payments/';

		$payload = array(
			'reference'   => $reference,
			'subscriber'  => array(
				'country' => 'MW',
				'currency' => 'MWK',
				'msisdn'  => $msisdn,
			),
			'transaction' => array(
				'amount'      => self::format_amount( $amount ),
				'country'     => 'MW',
				'currency'    => 'MWK',
				'id'          => $transaction_id,
			),
		);

		// Optional Airtel header keys (X-Key-Id / X-Product-Id etc.) if required.
		$headers = array(
			'Content-Type'  => 'application/json',
			'Accept'        => 'application/json',
			'Authorization' => 'Bearer ' . $token,
		);
		$api_key = $gw->get_option( 'api_key' );
		if ( $api_key ) {
			$headers['X-Key-Id'] = $api_key;
		}

		// Sign/extra headers: many Airtel products require a signature header.
		$signature_header = $gw->get_option( 'signature_header_name' );
		if ( $signature_header && $api_key ) {
			$headers[ $signature_header ] = hash( 'sha256', $transaction_id . $reference . self::format_amount( $amount ) );
		}

		$response = wp_remote_post( self::base_url() . $pay_path, array(
			'headers' => $headers,
			'body'    => wp_json_encode( $payload ),
			'timeout' => 30,
		) );

		self::log( 'Payment request -> ' . wp_json_encode( array(
			'url' => self::base_url() . $pay_path,
			'payload' => $payload,
			'http_code' => is_wp_error( $response ) ? 0 : wp_remote_retrieve_response_code( $response ),
			'response' => is_wp_error( $response ) ? $response->get_error_message() : wp_remote_retrieve_body( $response ),
		) ) );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $code >= 400 ) {
			return new WP_Error( 'sas_airtel_pay_failed', sprintf( __( 'Airtel payment request failed (HTTP %s): %s', 'sas-airtel-money' ), $code, wp_remote_retrieve_body( $response ) ) );
		}

		$body = $body ? $body : array();
		$body['_transaction_id'] = $transaction_id;

		return $body;
	}

	/**
	 * Format amount to the precision Airtel expects (no thousand separators).
	 *
	 * @param float $amount
	 * @return string
	 */
	public static function format_amount( $amount ) {
		return number_format( (float) $amount, 0, '.', '' );
	}

	/**
	 * Log helper.
	 *
	 * @param mixed $message
	 */
	public static function log( $message ) {
		if ( ! function_exists( 'wc_get_logger' ) ) {
			return;
		}
		$logger = wc_get_logger();
		$logger->info( is_string( $message ) ? $message : wp_json_encode( $message ), array( 'source' => 'sas-airtel-money' ) );
	}
}
