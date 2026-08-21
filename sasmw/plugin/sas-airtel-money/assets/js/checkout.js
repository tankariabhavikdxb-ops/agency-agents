/**
 * SAS Airtel Money checkout enhancements.
 * - Shows/hides the Airtel number field based on selected payment method.
 * - Light formatting/validation hint for +265 numbers.
 */
( function ( $ ) {
	'use strict';

	function isAirtelSelected() {
		var el = $( 'input[name="payment_method"][value="' + ( window.sasAirtel && window.sasAirtel.gatewayId ) + '"]' );
		return el.is( ':checked' );
	}

	function toggleField() {
		var $field = $( '#sas_airtel_msisdn' ).closest( 'p.form-row' );
		if ( isAirtelSelected() ) {
			$field.show();
		} else {
			$field.hide();
		}
	}

	$( function () {
		toggleField();
		$( 'body' ).on( 'change', 'input[name="payment_method"]', toggleField );
		$( 'body' ).on( 'updated_checkout', toggleField );

		// Auto-prefix +265 when a user types a local 9-digit or 10-digit number.
		$( document ).on( 'blur', '#sas_airtel_msisdn', function () {
			var val = $( this ).val().replace( /[^0-9+]/g, '' );
			if ( val.length === 9 && /^9/.test( val ) ) {
				$( this ).val( '+265' + val );
			} else if ( val.length === 10 && /^0/.test( val ) ) {
				$( this ).val( '+265' + val.slice( 1 ) );
			} else if ( val.length === 12 && /^265/.test( val ) ) {
				$( this ).val( '+' + val );
			}
		} );
	} );
} )( jQuery );
