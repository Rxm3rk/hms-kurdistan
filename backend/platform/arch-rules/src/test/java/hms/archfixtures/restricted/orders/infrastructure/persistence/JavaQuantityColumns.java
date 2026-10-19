package hms.archfixtures.restricted.orders.infrastructure.persistence;

import hms.archfixtures.restricted.kernel.quantity.Quantity;
import java.math.BigDecimal;

/** Compliant fixture: Java persistence mapping of a quantity's numeric column. */
public final class JavaQuantityColumns {
    /** Writes the column. */
    public BigDecimal write(Quantity quantity) {
        return quantity.magnitude();
    }

    /** Reads the column. */
    public Quantity read(BigDecimal column) {
        return Quantity.ofMagnitude(column, "mg");
    }
}
