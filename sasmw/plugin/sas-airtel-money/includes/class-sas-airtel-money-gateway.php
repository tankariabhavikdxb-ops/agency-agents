<?php
/**
 * WooCommerce Payment Gateway: Airtel Money.
 *
 * @package SAS_Airtel_Money
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class SAS_Airtel_Money_Gateway extends WC_Payment_Gateway {

	/** @var string Test (sandbox) mode flag. */
	public $test_mode;

	public function __construct() {
		$this->id                 = SAS_AIRTEL_GATEWAY_ID;
		$this->icon               = ''; // Optional: set to logo URL.
		$this->has_fields         = true; // We collect the Airtel number at checkout.
		$this->method_title       = __( 'Airtel Money', 'sas-airtel-money' );
		$this->method_description = __( 'Pay instantly with Airtel Money via USSD push (Airtel Malawi).', 'sas-airtel-money' );
		$this->supports           = array(
			'products',
			'refunds',
		);

		$this->init_form_fields();
		$this->init_settings();

		$this->title       = $this->get_option( 'title' );
		$this->description = $this->get_option( 'description' );
		$this->test_mode   = 'yes' === $this->get_option( 'test_mode' );

		add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
	}

	/**
	 * Settings fields shown in WooCommerce > Settings > Payments > Airtel Money.
	 */
	public function init_form_fields() {
		$this->form_fields = array(
			'enabled' => array(
				'title'   => __( 'Enable Airtel Money', 'sas-airtel-money' ),
				'type'    => 'checkbox',
				'label'   => __( 'Enable Airtel Money payments', 'sas-airtel-money' ),
				'default' => 'no',
			),
			'title' => array(
				'title'   => __( 'Title', 'sas-airtel-money' ),
				'type'    => 'text',
				'default' => __( 'Airtel Money', 'sas-airtel-money' ),
			),
			'description' => array(
				'title'       => __( 'Description', 'sas-airtel-money' ),
				'type'        => 'textarea',
				'default'     => __( 'Pay securely with Airtel Money. You will receive a USSD prompt on your phone to confirm.', 'sas-airtel-money' ),
			),
			'test_mode' => array(
				'title'   => __( 'Test (Sandbox) Mode', 'sas-airtel-money' ),
				'type'    => 'checkbox',
				'label'   => __( 'Enable sandbox / test mode', 'sas-airtel-money' ),
				'default' => 'yes',
			),
			'client_id' => array(
				'title'       => __( 'Airtel Client ID', 'sas-airtel-money' ),
				'type'        => 'password',
				'default'     => '',
				'desc_tip'    => __( 'From the Airtel Africa developer portal.', 'sas-airtel-money' ),
			),
			'client_secret' => array(
				'title'       => __( 'Airtel Client Secret', 'sas-airtel-money' ),
				'type'        => 'password',
				'default'     => '',
			),
			'api_key' => array(
				'title'       => __( 'API Key / X-Key-Id', 'sas-airtel-money' ),
				'type'        => 'password',
				'default'     => '',
				'desc_tip'    => __( 'Optional product API key if your Airtel product requires it.', 'sas-airtel-money' ),
			),
			'sandbox_api_base_url' => array(
				'title'   => __( 'Sandbox API Base URL', 'sas-airtel-money' ),
				'type'    => 'text',
				'default' => 'https://sandbox.openapi.airtel.africa',
			),
			'live_api_base_url' => array(
				'title'   => __( 'Live API Base URL', 'sas-airtel-money' ),
				'type'    => 'text',
				'default' => 'https://openapi.airtel.africa',
			),
			'token_path' => array(
				'title'   => __( 'Token Endpoint Path', 'sas-airtel-money' ),
				'type'    => 'text',
				'default' => '/auth/oauth2/token',
				'desc_tip' => __( 'Adjust only to match current Airtel docs.', 'sas-airtel-money' ),
			),
			'payment_path' => array(
				'title'   => __( 'Payment Endpoint Path', 'sas-airtel-money' ),
				'type'    => 'text',
				'default' => '/merchant/v2/payments/',
				'desc_tip' => __( 'Adjust only to match current Airtel docs.', 'sas-airtel-money' ),
			),
			'signature_header_name' => array(
				'title'   => __( 'Signature Header Name', 'sas-airtel-money' ),
				'type'    => 'text',
				'default' => 'X-Signature',
				'desc_tip' => __( 'Optional. If Airtel requires a signature header, set its name.', 'sas-airtel-money' ),
			),
			'manual_confirm' => array(
				'title'   => __( 'Manual / Offline Confirmation', 'sas-airtel-money' ),
				'type'    => 'checkbox',
				'label'   => __( 'Allow marking orders paid manually (useful as a launch bridge while live webhooks are being verified).', 'sas-airtel-money' ),
				'default' => 'yes',
			),
			'order_prefix' => array(
				'title'   => __( 'Order Reference Prefix', 'sas-airtel-money' ),
				'type'    => 'text',
				'default' => 'SASMW',
			),
		);
	}

	/**
	 * Render the Airtel Money number field at checkout.
	 */
	public function payment_fields() {
		if ( $this->description ) {
			echo wp_kses_post( wpautop( $this->description ) );
		}
		$default = WC()->customer && WC()->customer->get_billing_phone() ? WC()->customer->get_billing_phone() : '';
		?>
		<p class="form-row form-row-wide">
			<label for="sas_airtel_msisdn">
				<?php esc_html_e( 'Airtel Money Phone Number', 'sas-airtel-money' ); ?>
				<span class="required">*</span>
			</label>
			<input
				type="tel"
				class="input-text"
				name="sas_airtel_msisdn"
				id="sas_airtel_msisdn"
				placeholder="+265 99 123 4567"
				value="<?php echo esc_attr( $default ); ?>"
				autocomplete="tel"
			/>
			<span class="description">
				<?php esc_html_e( 'Enter the Airtel Money number that will receive the payment prompt (format: +265...).', 'sas-airtel-money' ); ?>
			</span>
		</p>
		<?php
	}

	/**
	 * Validate the phone number before order placement.
	 */
	public function validate_fields() {
		if ( empty( $_POST['sas_airtel_msisdn'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			wc_add_notice( __( 'Please enter your Airtel Money number.', 'sas-airtel-money' ), 'error' );
			return false;
		}

		$msisdn = $this->normalize_msisdn( sanitize_text_field( wp_unslash( $_POST['sas_airtel_msisdn'] ) ) ); // phpcs:ignore

		if ( ! $this->is_valid_mw_msisdn( $msisdn ) ) {
			wc_add_notice( __( 'Please enter a valid Malawian Airtel Money number, e.g. +265 99 123 4567.', 'sas-airtel-money' ), 'error' );
			return false;
		}

		WC()->session->set( 'sas_airtel_msisdn', $msisdn );
		return true;
	}

	/**
	 * Process the payment.
	 *
	 * @param int $order_id
	 * @return array
	 */
	public function process_payment( $order_id ) {
		$order  = wc_get_order( $order_id );
		$msisdn = WC()->session ? WC()->session->get( 'sas_airtel_msisdn' ) : '';
		if ( empty( $msisdn ) && ! empty( $_POST['sas_airtel_msisdn'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			$msisdn = $this->normalize_msisdn( sanitize_text_field( wp_unslash( $_POST['sas_airtel_msisdn'] ) ) ); // phpcs:ignore
		}

		$order->add_meta_data( '_sas_airtel_msisdn', $msisdn );
		$order->add_order_note( sprintf( 'Airtel Money payment attempted for %s.', $msisdn ) );

		// If not live, or API call fails, we can fall back to manual/on-hold so the sale is not lost.
		$reference = $this->build_reference( $order );
		$amount    = $order->get_total();

		if ( ! $this->test_mode ) {
			$result = SAS_Airtel_Money_API::request_payment( $amount, $msisdn, $reference );

			if ( ! is_wp_error( $result ) ) {
				$order->update_status( 'on-hold', __( 'Airtel Money USSD push sent to customer. Awaiting webhook confirmation.', 'sas-airtel-money' ) );
				$order->add_meta_data( '_sas_airtel_reference', $reference );
				$order->add_meta_data( '_sas_airtel_txid', isset( $result['_transaction_id'] ) ? $result['_transaction_id'] : '' );
				$order->save();

				// Reduce stock automatically.
				wc_reduce_stock_levels( $order_id );

				return array(
					'result'   => 'success',
					'redirect' => $this->get_return_url( $order ),
				);
			}

			// Live API failed — log and fall through to manual if enabled, else fail.
			SAS_Airtel_Money_API::log( 'Live payment request failed: ' . $result->get_error_message() );
			if ( 'yes' !== $this->get_option( 'manual_confirm' ) ) {
				wc_add_notice( __( 'Airtel Money could not start your payment. Please try again or contact support.', 'sas-airtel-money' ), 'error' );
				return array( 'result' => 'failure' );
			}
		}

		// Manual / test mode: put the order on-hold and let the admin confirm (or auto-confirm in test).
		$order->add_meta_data( '_sas_airtel_reference', $reference );
		$order->save();

		if ( $this->test_mode && 'yes' === $this->get_option( 'manual_confirm' ) ) {
			// In sandbox we simulate a successful callback immediately for smooth testing.
			$this->simulate_success_callback( $order );
			wc_reduce_stock_levels( $order_id );
			return array(
				'result'   => 'success',
				'redirect' => $this->get_return_url( $order ),
			);
		}

		$order->update_status( 'on-hold', __( 'Airtel Money payment awaiting confirmation.', 'sas-airtel-money' ) );
		wc_reduce_stock_levels( $order_id );

		return array(
			'result'   => 'success',
			'redirect' => $this->get_return_url( $order ),
		);
	}

	/**
	 * Simulate a successful callback (test mode only).
	 *
	 * @param WC_Order $order
	 */
	public function simulate_success_callback( $order ) {
		if ( ! $this->test_mode ) {
			return;
		}
		SAS_Airtel_Money_Webhook::handle_success( $order->get_id() );
	}

	/**
	 * Build a unique payment reference for Airtel.
	 *
	 * @param WC_Order $order
	 * @return string
	 */
	public function build_reference( $order ) {
		$prefix = $this->get_option( 'order_prefix' ) ? $this->get_option( 'order_prefix' ) : 'SASMW';
		return $prefix . '-' . $order->get_id() . '-' . wp_rand( 1000, 9999 );
	}

	/**
	 * Normalize a phone number to international +265 format.
	 *
	 * @param string $raw
	 * @return string
	 */
	public function normalize_msisdn( $raw ) {
		$raw = preg_replace( '/[^0-9+]/', '', $raw );

		if ( '0' === substr( $raw, 0, 1 ) && strlen( $raw ) === 10 ) {
			return '+265' . substr( $raw, 1 );
		}

		if ( 0 === strpos( $raw, '265' ) && strlen( $raw ) === 12 ) {
			return '+' . $raw;
		}

		if ( 0 === strpos( $raw, '+' ) ) {
			return $raw;
		}

		return $raw;
	}

	/**
	 * Validate a Malawian MSISDN (Airtel Malawi prefixes: 9x, e.g. 99 / 98 / 96 / 97...).
	 *
	 * @param string $msisdn
	 * @return bool
	 */
	public function is_valid_mw_msisdn( $msisdn ) {
		return (bool) preg_match( '/^\+?265(9[0-9]{8}|88[0-9]{6})$/i', $msisdn );
	}
}
