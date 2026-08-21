<?php
/**
 * E-Ticket + QR code generation.
 *
 * Produces one e-ticket per purchased ticket (respecting quantity), each with:
 *  - a unique ticket ID
 *  - a QR code (image) encoding the ticket verification data
 *  - match details (product name + short description), category, price
 *  - customer name and order date
 *
 * QR generation: uses the free public QR image service (api.qrserver.com) by
 * default and caches the PNG locally. For heavy production traffic you may
 * prefer a local PHP QR library (e.g. chillerlan/php-qrcode) — swap
 * self::make_qr() to use it. See docs/06-eticket-qr.md.
 *
 * PDF: the plugin attaches the ticket as an order download so WooCommerce's
 * "order complete" email carries it; for printable PDF tickets install the
 * "WooCommerce PDF Invoices & Packing Slips" plugin (free) — see docs.
 *
 * @package SAS_Airtel_Money
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class SAS_Airtel_Money_ETicket {

	/** @var WC_Order */
	private $order;

	public function __construct( $order ) {
		$this->order = $order;
	}

	/**
	 * Generate tickets for all line items in the order and email them.
	 */
	public function generate() {
		$tickets = $this->build_tickets();

		if ( empty( $tickets ) ) {
			return false;
		}

		// Store on the order.
		$this->order->update_meta_data( '_sas_airtel_tickets', $tickets );
		$this->order->save();

		$this->send_email( $tickets );

		return $tickets;
	}

	/**
	 * Build the ticket array for every line-item/quantity.
	 *
	 * @return array
	 */
	private function build_tickets() {
		$tickets = array();

		foreach ( $this->order->get_items() as $item ) {
			$product   = $item->get_product();
			$qty       = (int) $item->get_quantity();
			$variation = $this->variation_label( $item );

			for ( $i = 1; $i <= $qty; $i++ ) {
				$ticket_id = $this->unique_ticket_id();
				$qr_data   = $this->qr_payload( $ticket_id );

				$tickets[] = array(
					'ticket_id'   => $ticket_id,
					'product'     => $product ? $product->get_name() : $item->get_name(),
					'category'    => $variation,
					'price'       => $item->get_total(),
					'qr_image'    => $this->make_qr( $qr_data ),
					'qr_data'     => $qr_data,
					'match_meta'  => $this->match_meta(),
					'customer'    => trim( $this->order->get_billing_first_name() . ' ' . $this->order->get_billing_last_name() ),
					'order_id'    => $this->order->get_id(),
					'date'        => $this->order->get_date_paid() ? $this->order->get_date_paid()->date( 'Y-m-d H:i' ) : date_i18n( 'Y-m-d H:i' ),
				);
			}
		}

		return $tickets;
	}

	/**
	 * Variation label (VIP / Standard / General).
	 *
	 * @param WC_Order_Item_Product $item
	 * @return string
	 */
	private function variation_label( $item ) {
		$meta = $item->get_meta_data();
		foreach ( $meta as $m ) {
			if ( is_a( $m->get_data()['key'], 'Stringable' ) ) {
				$key = (string) $m->get_data()['key'];
			} else {
				$key = $m->get_data()['key'];
			}
			if ( false !== stripos( (string) $key, 'category' ) ) {
				return $m->get_data()['value'];
			}
		}
		return $item->get_name();
	}

	/**
	 * Pull match metadata (date/time/venue) from product custom fields.
	 *
	 * @return array
	 */
	private function match_meta() {
		$meta = array();
		foreach ( $this->order->get_items() as $item ) {
			$product = $item->get_product();
			if ( ! $product ) {
				continue;
			}
			$meta['venue']  = get_post_meta( $product->get_id(), '_sas_match_venue', true );
			$meta['date']   = get_post_meta( $product->get_id(), '_sas_match_date', true );
			$meta['time']   = get_post_meta( $product->get_id(), '_sas_match_time', true );
			$meta['league'] = get_post_meta( $product->get_id(), '_sas_match_league', true );
			break;
		}
		return $meta;
	}

	/**
	 * Unique ticket ID.
	 *
	 * @return string
	 */
	private function unique_ticket_id() {
		return 'SAS' . strtoupper( substr( wp_generate_uuid4(), 0, 12 ) ) . $this->order->get_id();
	}

	/**
	 * Verification payload for the QR code.
	 *
	 * @param string $ticket_id
	 * @return string
	 */
	private function qr_payload( $ticket_id ) {
		return wp_json_encode( array(
			'ticket' => $ticket_id,
			'order'  => $this->order->get_id(),
			'amount' => $this->order->get_total(),
			'date'   => current_time( 'Y-m-d H:i:s' ),
		) );
	}

	/**
	 * Create (and cache) a QR code PNG.
	 *
	 * @param string $data
	 * @return string Absolute URL to the cached PNG, or empty on failure.
	 */
	private function make_qr( $data ) {
		$upload = wp_upload_dir();
		$hash   = md5( $data );
		$file   = trailingslashit( $upload['path'] ) . 'sas-qr-' . $hash . '.png';

		if ( file_exists( $file ) ) {
			return trailingslashit( $upload['url'] ) . 'sas-qr-' . $hash . '.png';
		}

		$api = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' . rawurlencode( $data );
		$res = wp_remote_get( $api, array( 'timeout' => 20 ) );

		if ( is_wp_error( $res ) || 200 !== wp_remote_retrieve_response_code( $res ) ) {
			return '';
		}

		$png = wp_remote_retrieve_body( $res );
		if ( ! $png ) {
			return '';
		}

		global $wp_filesystem;
		if ( ! function_exists( 'WP_Filesystem' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
		WP_Filesystem();
		$wp_filesystem->put_contents( $file, $png, FS_CHMOD_FILE );

		return trailingslashit( $upload['url'] ) . 'sas-qr-' . $hash . '.png';
	}

	/**
	 * Send the e-ticket email(s).
	 *
	 * @param array $tickets
	 */
	private function send_email( $tickets ) {
		$to      = $this->order->get_billing_email();
		$subject = sprintf( __( 'Your Match E-Ticket(s) — Order #%s', 'sas-airtel-money' ), $this->order->get_order_number() );

		$body  = '<div style="font-family:Poppins,Arial,sans-serif;background:#1A1A2E;color:#fff;padding:24px;border-radius:12px;">';
		$body .= '<h2 style="color:#00C853;">' . esc_html__( 'Payment Successful — Enjoy the Match!', 'sas-airtel-money' ) . '</h2>';
		$body .= '<p>' . esc_html__( 'Thank you for purchasing with Serve All Solutions. Show the QR code(s) below at the stadium entrance to gain entry.', 'sas-airtel-money' ) . '</p>';

		foreach ( $tickets as $t ) {
			$body .= '<div style="background:#1B2A4A;border:1px solid #2c3e66;border-radius:10px;padding:16px;margin-bottom:16px;">';
			$body .= '<p><strong>' . esc_html( $t['product'] ) . '</strong></p>';
			$body .= '<p>' . esc_html__( 'Ticket ID:', 'sas-airtel-money' ) . ' <strong>' . esc_html( $t['ticket_id'] ) . '</strong></p>';
			$body .= '<p>' . esc_html__( 'Category:', 'sas-airtel-money' ) . ' ' . esc_html( $t['category'] ) . '</p>';
			if ( ! empty( $t['match_meta'] ) ) {
				if ( ! empty( $t['match_meta']['league'] ) ) { $body .= '<p>' . esc_html( $t['match_meta']['league'] ) . '</p>'; }
				if ( ! empty( $t['match_meta']['date'] ) ) { $body .= '<p>' . esc_html__( 'Date:', 'sas-airtel-money' ) . ' ' . esc_html( $t['match_meta']['date'] ) . ( ! empty( $t['match_meta']['time'] ) ? ' @ ' . esc_html( $t['match_meta']['time'] ) : '' ) . '</p>'; }
				if ( ! empty( $t['match_meta']['venue'] ) ) { $body .= '<p>' . esc_html__( 'Venue:', 'sas-airtel-money' ) . ' ' . esc_html( $t['match_meta']['venue'] ) . '</p>'; }
			}
			$body .= '<p>' . esc_html__( 'Customer:', 'sas-airtel-money' ) . ' ' . esc_html( $t['customer'] ) . '</p>';
			if ( $t['qr_image'] ) {
				$body .= '<img src="' . esc_url( $t['qr_image'] ) . '" width="180" height="180" alt="QR" style="background:#fff;padding:6px;border-radius:8px;" />';
			}
			$body .= '</div>';
		}

		$body .= '<p style="color:#E0E0E0;font-size:12px;">' . esc_html__( 'This is an automated message. For help contact support@sasmw.com or +265...', 'sas-airtel-money' ) . '</p>';
		$body .= '</div>';

		$headers = array(
			'Content-Type: text/html; charset=UTF-8',
			'From: Serve All Solutions Tickets <tickets@sasmw.com>',
		);

		wp_mail( $to, $subject, $body, $headers );

		// Also notify the site admin.
		wp_mail( get_option( 'admin_email' ), 'New ticket sale - Order #' . $this->order->get_order_number(), 'A ticket was sold via Airtel Money. Order: ' . $this->order->get_id() );
	}
}
