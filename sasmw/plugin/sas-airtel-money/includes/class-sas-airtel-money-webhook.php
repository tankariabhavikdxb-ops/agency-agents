<?php
/**
 * Airtel Money Webhook handler.
 *
 * Airtel calls the registered callback URL to confirm payment status.
 * Endpoint: https://sasmw.com/wc-api/sas_airtel_money?key=sas_airtel_money
 *
 * @package SAS_Airtel_Money
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class SAS_Airtel_Money_Webhook {

	/**
	 * Register the WC-API endpoint listener.
	 */
	public static function register() {
		add_action( 'woocommerce_api_' . SAS_AIRTEL_WEBHOOK_KEY, array( __CLASS__, 'handle_webhook' ) );
	}

	/**
	 * Handle an incoming Airtel callback.
	 */
	public static function handle_webhook() {
		$input = file_get_contents( 'php://input' );
		$data  = json_decode( $input, true );
		$data  = $data ? $data : $_REQUEST; // phpcs:ignore WordPress.Security.NonceVerification

		SAS_Airtel_Money_API::log( 'Webhook received: ' . ( is_string( $input ) ? $input : wp_json_encode( $data ) ) );

		// Airtel sends the reference and status in different shapes depending on product.
		// We look for the reference we created (SASMW-<orderid>-<rand>) and a status code.
		$reference = self::find_reference( $data );
		$status    = self::find_status( $data );

		if ( ! $reference ) {
			status_header( 400 );
			echo 'Missing reference';
			exit;
		}

		// Extract order id from reference: SASMW-<id>-<rand>
		if ( ! preg_match( '/-(\d+)-/', $reference, $m ) ) {
			status_header( 400 );
			echo 'Invalid reference';
			exit;
		}
		$order_id = (int) $m[1];
		$order    = wc_get_order( $order_id );

		if ( ! $order ) {
			status_header( 404 );
			echo 'Order not found';
			exit;
		}

		// Verify amount if provided.
		$amount = self::find_amount( $data );
		if ( null !== $amount ) {
			$expected = $order->get_total();
			if ( abs( (float) $amount - (float) $expected ) > 1 ) {
				$order->update_status( 'failed', __( 'Airtel webhook amount mismatch.', 'sas-airtel-money' ) );
				status_header( 400 );
				echo 'Amount mismatch';
				exit;
			}
		}

		if ( self::status_is_success( $status ) ) {
			self::handle_success( $order_id );
		} else {
			self::handle_failure( $order_id, $status );
		}

		// Acknowledge so Airtel stops retrying.
		status_header( 200 );
		echo 'SUCCESS';
		exit;
	}

	/**
	 * Mark an order paid + generate e-ticket.
	 *
	 * @param int $order_id
	 */
	public static function handle_success( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		if ( $order->is_paid() ) {
			return;
		}

		$order->payment_complete();
		$order->add_order_note( __( 'Airtel Money payment confirmed. Generating e-ticket.', 'sas-airtel-money' ) );
		$order->save();

		// Generate e-ticket + QR and email it.
		$eticket = new SAS_Airtel_Money_ETicket( $order );
		$eticket->generate();
	}

	/**
	 * Mark an order failed.
	 *
	 * @param int    $order_id
	 * @param string $status
	 */
	public static function handle_failure( $order_id, $status = '' ) {
		$order = wc_get_order( $order_id );
		if ( ! $order || $order->is_paid() ) {
			return;
		}
		$note = sprintf( __( 'Airtel Money payment failed. Status: %s', 'sas-airtel-money' ), $status ? $status : 'unknown' );
		$order->update_status( 'failed', $note );
	}

	/* ---------------- helpers ---------------- */

	private static function find_reference( $data ) {
		foreach ( array( 'reference', 'transactionRef', 'externalReference', 'msisdn', 'transaction_reference', 'ref' ) as $key ) {
			if ( isset( $data[ $key ] ) && false !== strpos( (string) $data[ $key ], 'SASMW' ) ) {
				return $data[ $key ];
			}
		}
		// Recursive scan.
		return self::recursive_search( $data, 'SASMW', true );
	}

	private static function find_status( $data ) {
		foreach ( array( 'status', 'transactionStatus', 'result', 'statusCode', 'responseCode' ) as $key ) {
			if ( isset( $data[ $key ] ) ) {
				return $data[ $key ];
			}
		}
		return self::recursive_search( $data, array( 'TS', 'TF', 'SUCCESS', 'SUCCES', 'FAIL', 'FAILED', '1', '0', '200', 'TS' ), false );
	}

	private static function find_amount( $data ) {
		foreach ( array( 'amount', 'transactionAmount', 'paidAmount' ) as $key ) {
			if ( isset( $data[ $key ] ) ) {
				return $data[ $key ];
			}
		}
		return null;
	}

	private static function recursive_search( $data, $needle, $return_full ) {
		if ( ! is_array( $data ) ) {
			return null;
		}
		foreach ( $data as $k => $v ) {
			if ( is_array( $v ) ) {
				$found = self::recursive_search( $v, $needle, $return_full );
				if ( $found ) {
					return $found;
				}
			} elseif ( is_string( $v ) ) {
				if ( $return_full && false !== strpos( $v, $needle ) ) {
					return $v;
				}
				if ( ! $return_full && in_array( strtoupper( $v ), (array) $needle, true ) ) {
					return $v;
				}
			}
		}
		return null;
	}

	private static function status_is_success( $status ) {
		if ( null === $status ) {
			return false;
		}
		$status = strtoupper( (string) $status );
		$success = array( 'TS', 'SUCCESS', 'SUCCES', 'APPROVED', 'COMPLETED', '200', '1', 'SUCCESSFUL', 'SUCCEEDED', '100', '000' );
		return in_array( $status, $success, true );
	}
}
