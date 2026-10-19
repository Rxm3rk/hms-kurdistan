package hms.archfixtures.restricted.orders.application;

import hms.archfixtures.restricted.kernel.quantity.Quantity;
import java.math.BigDecimal;

/** Violating fixture for dose-and-quantity-operations-only-in-reg-dose: Java reads a magnitude. */
public final class JavaReadsQuantityMagnitude {
    /** Takes the number out of a quantity. */
    public BigDecimal read(Quantity quantity) {
        return quantity.magnitude();
    }
}
