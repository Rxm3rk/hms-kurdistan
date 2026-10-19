package hms.adt.domain.common

/**
 * The connectivity mode a command was issued in (BUILD-PROMPT §2.1 SI-15 clause b; §16.3; CTRL-0015-3). Internet or
 * WAN loss is not a mode: a client that has lost the internet but still reaches the on-site cell is in [ON_SITE_CELL]
 * (SI-15 clause h; §16.3 L1).
 */
enum class ConnectivityMode {
    /** Connected to the hospital's on-site cell. */
    ON_SITE_CELL,

    /** The on-site cell is lost. */
    CELL_LOST,

    /** Working through a ward edge agent. */
    EDGE_AGENT,

    /** A mobile client working offline. */
    MOBILE_OFFLINE,
}

/** How a command reached the adt domain. */
enum class CommandChannel {
    /** A client (web, desktop or mobile); its mode is the mode it reports at issue. */
    CLIENT,

    /**
     * A channel that runs inside the cell: HL7 inbound, the migration loader, plugins, AI agents acting through the
     * cell's API. It is in the on-site-cell mode by construction (encounter.yaml and bed.yaml `onSiteCellConnected`).
     */
    IN_CELL,
}

/**
 * The bed-allocation row of the offline matrix (data, ADR-012, CTRL-0015-3), implemented once for the encounter and
 * bed machines' `onSiteCellConnected` (encounter.yaml, bed.yaml: "The same definition is used by the bed machine and
 * implemented once in the adt domain"). SI-15 clause b is vendor-locked: bed allocation is allowed only in the
 * on-site-cell mode. The predicate never reads WAN state, because internet loss alone never changes the mode.
 */
object OfflineMatrix {
    /** The modes in which the offline matrix allows bed allocation (SI-15 clause b, vendor-locked). */
    val BED_ALLOCATION_MODES: Set<ConnectivityMode> = setOf(ConnectivityMode.ON_SITE_CELL)

    /**
     * The mode the command was issued in: [ConnectivityMode.ON_SITE_CELL] for an in-cell channel, otherwise the
     * client's mode at issue (not at processing: SI-15 clause f). Null when the client's mode is unknown.
     */
    fun modeAtIssue(
        channel: CommandChannel,
        clientModeAtIssue: ConnectivityMode?,
    ): ConnectivityMode? =
        when (channel) {
            CommandChannel.IN_CELL -> ConnectivityMode.ON_SITE_CELL
            CommandChannel.CLIENT -> clientModeAtIssue
        }

    /** True when a command issued on [channel] in [clientModeAtIssue] may allocate a bed; an unknown mode fails. */
    fun allowsBedAllocation(
        channel: CommandChannel,
        clientModeAtIssue: ConnectivityMode?,
    ): Boolean = modeAtIssue(channel, clientModeAtIssue) in BED_ALLOCATION_MODES
}
