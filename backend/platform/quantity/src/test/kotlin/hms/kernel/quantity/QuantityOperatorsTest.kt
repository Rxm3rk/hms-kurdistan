package hms.kernel.quantity

import hms.kernel.archrules.ProjectArchitecture
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.shouldBe
import java.lang.reflect.Method

/**
 * `UnitTest:quantity-has-no-operators` (platform-kernel.md §10.1, §11, §17; SI-05; §6.8 #1): `Quantity`, `DoseQuantity`
 * and `DoseRate` declare no operator functions, no class of hms.kernel.quantity declares one as an extension on them,
 * and none of them is `Comparable`. Reflection sees names, not the `operator` modifier, so any function with an
 * operator's name counts.
 */
class QuantityOperatorsTest :
    FunSpec({
        test("quantity-has-no-operators: no operator functions on or for the quantity types; none is Comparable") {
            val classes =
                ProjectArchitecture
                    .importProductionClasses()
                    .filter { it.packageName == "hms.kernel.quantity" }
                    .map { it.reflect() }
            classes.shouldNotBeEmpty()
            classes.flatMap { operatorFunctions(it, QUANTITY_TYPES) }.shouldBeEmpty()
            QUANTITY_TYPES.filter { Comparable::class.java.isAssignableFrom(it) }.shouldBeEmpty()
        }

        test("quantity-has-no-operators: the check finds operators in a violating fixture") {
            val fixtureTypes = setOf<Class<*>>(OperatorFixture::class.java)
            val found = listOf(OperatorFixture::class.java, OperatorExtensions::class.java).flatMap { operatorFunctions(it, fixtureTypes) }
            found.map { it.substringAfterLast('.') } shouldContainExactlyInAnyOrder listOf("plus", "unaryMinus", "compareTo", "times")
            Comparable::class.java.isAssignableFrom(OperatorFixture::class.java) shouldBe true
            operatorFunctions(CompliantFixture::class.java, setOf(CompliantFixture::class.java)).shouldBeEmpty()
        }
    })

private val QUANTITY_TYPES: Set<Class<*>> = setOf(Quantity::class.java, DoseQuantity::class.java, DoseRate::class.java)

private val OPERATOR_NAMES: Set<String> =
    setOf(
        "plus",
        "minus",
        "times",
        "div",
        "rem",
        "mod",
        "unaryMinus",
        "unaryPlus",
        "inc",
        "dec",
        "rangeTo",
        "rangeUntil",
        "compareTo",
        "plusAssign",
        "minusAssign",
        "timesAssign",
        "divAssign",
        "remAssign",
    )

/** Methods of [type] with an operator's name declared on one of [types] or taking one of them as receiver. */
private fun operatorFunctions(
    type: Class<*>,
    types: Set<Class<*>>,
): List<String> =
    type.declaredMethods
        .filter { it.name in OPERATOR_NAMES && !it.isSynthetic }
        .filter { method -> type in types || method.receiverIn(types) }
        .map { "${type.name}.${it.name}" }

private fun Method.receiverIn(types: Set<Class<*>>): Boolean = parameterTypes.firstOrNull() in types

private class OperatorFixture(
    val value: Int,
) : Comparable<OperatorFixture> {
    operator fun plus(other: OperatorFixture): OperatorFixture = OperatorFixture(value + other.value)

    operator fun unaryMinus(): OperatorFixture = OperatorFixture(-value)

    override fun compareTo(other: OperatorFixture): Int = value.compareTo(other.value)
}

private object OperatorExtensions {
    operator fun OperatorFixture.times(factor: Int): OperatorFixture = OperatorFixture(value * factor)
}

private class CompliantFixture(
    val value: Int,
) {
    fun describe(): String = "value $value"
}
