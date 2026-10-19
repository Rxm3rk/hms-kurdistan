package hms.kernel.money

import hms.kernel.archrules.ProjectArchitecture
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.collections.shouldNotBeEmpty
import java.lang.reflect.GenericArrayType
import java.lang.reflect.Modifier
import java.lang.reflect.ParameterizedType
import java.lang.reflect.Type
import java.lang.reflect.TypeVariable
import java.lang.reflect.WildcardType

/**
 * `UnitTest:money-api-has-no-floating-point` (platform-kernel.md §11, §17; BUILD-PROMPT §6.2): no public member
 * of `hms.kernel.money` takes or returns `Double`, `Float` or their boxed forms, also inside generic types and arrays.
 */
class MoneyApiTest :
    FunSpec({
        test("money-api-has-no-floating-point: no public member of hms.kernel.money takes or returns Double or Float") {
            val classes =
                ProjectArchitecture
                    .importProductionClasses()
                    .filter { it.packageName == "hms.kernel.money" }
                    .map { it.reflect() }
            classes.shouldNotBeEmpty()
            classes.flatMap { floatingPointMembers(it) }.shouldBeEmpty()
        }

        test("money-api-has-no-floating-point: the check finds floating point in a violating fixture") {
            floatingPointMembers(FloatingPointFixture::class.java).map { it.substringAfterLast('.') } shouldContainExactlyInAnyOrder
                listOf("ratio returns", "scale takes", "ratios returns", "weights takes", "field")
            floatingPointMembers(CompliantFixture::class.java).shouldBeEmpty()
        }
    })

private val floatingPointTypes: Set<Class<*>> =
    setOf(Double::class.javaPrimitiveType!!, Double::class.javaObjectType, Float::class.javaPrimitiveType!!, Float::class.javaObjectType)

/** Public constructors, methods and fields of [type] whose signature mentions a floating-point type. */
private fun floatingPointMembers(type: Class<*>): List<String> {
    val name = type.name
    val constructors =
        type.declaredConstructors
            .filter { Modifier.isPublic(it.modifiers) && it.genericParameterTypes.any(::mentionsFloatingPoint) }
            .map { "$name.<init> takes" }
    val methods =
        type.declaredMethods
            .filter { Modifier.isPublic(it.modifiers) && !it.isSynthetic }
            .flatMap { method ->
                listOfNotNull(
                    "$name.${method.name} returns".takeIf { mentionsFloatingPoint(method.genericReturnType) },
                    "$name.${method.name} takes".takeIf { method.genericParameterTypes.any(::mentionsFloatingPoint) },
                )
            }
    val fields =
        type.declaredFields
            .filter { Modifier.isPublic(it.modifiers) && mentionsFloatingPoint(it.genericType) }
            .map { "$name.field" }
    return constructors + methods + fields
}

private fun mentionsFloatingPoint(type: Type): Boolean =
    when (type) {
        is Class<*> -> type in floatingPointTypes || (type.isArray && mentionsFloatingPoint(type.componentType))
        is ParameterizedType -> type.actualTypeArguments.any(::mentionsFloatingPoint)
        is GenericArrayType -> mentionsFloatingPoint(type.genericComponentType)
        is WildcardType -> (type.upperBounds + type.lowerBounds).any(::mentionsFloatingPoint)
        is TypeVariable<*> -> type.bounds.any(::mentionsFloatingPoint)
        else -> false
    }

/** Violating fixture: each public member mentions a floating-point type. */
class FloatingPointFixture {
    @JvmField
    val field: Double = 0.5

    fun ratio(): Double = field

    fun scale(factor: Float): String = factor.toString()

    fun ratios(): List<Double> = listOf(0.5)

    fun weights(values: DoubleArray): Int = values.size
}

/** Compliant fixture: decimal and integer types only. */
class CompliantFixture {
    fun ratio(): java.math.BigDecimal = java.math.BigDecimal.ONE

    fun count(values: List<Long>): Int = values.size
}
