package hms.archfixtures.modules.alpha

/** Module fixture: the root package of module "alpha", which is not part of its api. */
object AlphaModule {
    const val NAME: String = "alpha"

    fun name(): String = NAME
}
